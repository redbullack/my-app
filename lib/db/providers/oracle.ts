/**
 * @module lib/db/providers/oracle
 * @description
 * Oracle 프로바이더 어댑터. oracledb 의 connection pool 을 DB 이름별로 캐싱하고,
 * raw 에러를 DbError 로 변환한다. factory 외부에서 직접 import 하지 않는다.
 *
 * 풀 캐싱은 Next.js dev HMR 환경에서의 누수 방지를 위해 globalThis 에 보관.
 */

import oracledb from 'oracledb'
import type {
  BindParams,
  ExecuteResult,
  IDbClient,
  IDbProvider,
  PoolOptions,
  QueryOptions,
  ResolvedDsn,
} from '../types'
import { DbError, categorizeOracleError } from '../errors'
import { getDbLogger } from '../logger'

/** HMR-safe 풀 저장소. globalThis 에 두어 dev 리로드 간에도 동일 풀 재사용. */
type PoolStore = Map<string, Promise<oracledb.Pool>>
const GLOBAL_KEY = '__myapp_oracle_pools__'
function getPoolStore(): PoolStore {
  const g = globalThis as unknown as Record<string, PoolStore | undefined>
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = new Map()
  return g[GLOBAL_KEY]!
}

/**
 * 평문 connectString (`user/password@host:port/service`) 을 oracledb 입력 형태로 파싱.
 * password 에 `@` 가 들어있는 경우는 본 학습 프레임워크 범위 밖.
 */
export function parseOracleDsn(plain: string): ResolvedDsn {
  const at = plain.indexOf('@')
  if (at < 0) {
    throw new DbError({
      category: 'config',
      devMessage: `Oracle connectString 형식 오류 — '@' 구분자가 없습니다: ${plain}`,
    })
  }
  const cred = plain.slice(0, at)
  const host = plain.slice(at + 1)
  const slash = cred.indexOf('/')
  if (slash < 0) {
    throw new DbError({
      category: 'config',
      devMessage: `Oracle connectString 형식 오류 — 'user/password' 구분자가 없습니다.`,
    })
  }
  return {
    user: cred.slice(0, slash),
    password: cred.slice(slash + 1),
    connectString: host,
  }
}

async function getPool(
  dbName: string,
  dsn: ResolvedDsn,
  pool: PoolOptions | undefined,
): Promise<oracledb.Pool> {
  const store = getPoolStore()
  let p = store.get(dbName)
  if (p) return p

  const log = getDbLogger()
  p = oracledb
    .createPool({
      user: dsn.user,
      password: dsn.password,
      connectString: dsn.connectString,
      poolAlias: `myapp:${dbName}`,
      poolMin: pool?.min ?? 1,
      poolMax: pool?.max ?? 10,
      poolIncrement: pool?.increment ?? 1,
      poolTimeout: pool?.timeoutSec ?? 60,
    })
    .then((created) => {
      log.info('pool.created', {
        db: dbName,
        provider: 'oracle',
        min: pool?.min ?? 1,
        max: pool?.max ?? 10,
      })
      return created
    })
    .catch((err: unknown) => {
      // 실패 시 캐시에서 제거 → 다음 호출에 재시도 가능
      store.delete(dbName)
      const { category, code } = categorizeOracleError(err)
      throw new DbError({
        category: category === 'unknown' ? 'connection' : category,
        code,
        cause: err,
        devMessage: `Oracle 풀 생성 실패 (db=${dbName})`,
      })
    })

  store.set(dbName, p)
  return p
}

function toExecuteOptions(opts: QueryOptions, autoCommit: boolean): oracledb.ExecuteOptions {
  const out: oracledb.ExecuteOptions = {
    outFormat: oracledb.OUT_FORMAT_OBJECT,
    autoCommit,
  }
  if (opts.maxRows !== undefined) out.maxRows = opts.maxRows
  return out
}

function toDbError(err: unknown, dbName: string, traceId: string | undefined): DbError {
  const { category, code } = categorizeOracleError(err)
  return new DbError({
    category,
    code,
    traceId,
    cause: err,
    devMessage: `Oracle 쿼리 실패 (db=${dbName})`,
  })
}

async function runOnConnection<T>(
  conn: oracledb.Connection,
  sql: string,
  binds: BindParams,
  opts: QueryOptions,
  autoCommit: boolean,
): Promise<oracledb.Result<T>> {
  // oracledb 의 timeout 은 connection.callTimeout (ms)
  if (opts.timeoutMs !== undefined) {
    ;(conn as oracledb.Connection & { callTimeout?: number }).callTimeout = opts.timeoutMs
  }
  return conn.execute<T>(sql, binds as oracledb.BindParameters, toExecuteOptions(opts, autoCommit))
}

async function oracleQuery<T>(
  dbName: string,
  dsn: ResolvedDsn,
  pool: PoolOptions | undefined,
  sql: string,
  binds: BindParams,
  opts: QueryOptions,
): Promise<T[]> {
  const p = await getPool(dbName, dsn, pool)
  const conn = await p.getConnection()
  try {
    const result = await runOnConnection<T>(conn, sql, binds, opts, true)
    return (result.rows ?? []) as T[]
  } catch (err) {
    throw toDbError(err, dbName, opts.traceId)
  } finally {
    try {
      await conn.close()
    } catch {
      /* 풀 반납 실패는 별도 로깅 없이 무시 — pool 자체가 회수한다 */
    }
  }
}

async function oracleExecute<T>(
  dbName: string,
  dsn: ResolvedDsn,
  pool: PoolOptions | undefined,
  sql: string,
  binds: BindParams,
  opts: QueryOptions,
): Promise<ExecuteResult<T>> {
  const p = await getPool(dbName, dsn, pool)
  const conn = await p.getConnection()
  try {
    const result = await runOnConnection<T>(conn, sql, binds, opts, true)
    return {
      rows: (result.rows ?? []) as T[],
      rowsAffected: result.rowsAffected ?? 0,
    }
  } catch (err) {
    throw toDbError(err, dbName, opts.traceId)
  } finally {
    try {
      await conn.close()
    } catch {
      /* noop */
    }
  }
}

async function oracleWithTransaction<R>(
  dbName: string,
  dsn: ResolvedDsn,
  pool: PoolOptions | undefined,
  fn: (tx: IDbClient) => Promise<R>,
): Promise<R> {
  const p = await getPool(dbName, dsn, pool)
  const conn = await p.getConnection()

  // 트랜잭션 내부 클라이언트 — 동일 conn 위에서 동작, autoCommit=false
  const tx: IDbClient = {
    async query<T>(sql: string, binds: BindParams = {}, opts: QueryOptions = {}): Promise<T[]> {
      try {
        const result = await runOnConnection<T>(conn, sql, binds, opts, false)
        return (result.rows ?? []) as T[]
      } catch (err) {
        throw toDbError(err, dbName, opts.traceId)
      }
    },
    async execute<T>(
      sql: string,
      binds: BindParams = {},
      opts: QueryOptions = {},
    ): Promise<ExecuteResult<T>> {
      try {
        const result = await runOnConnection<T>(conn, sql, binds, opts, false)
        return {
          rows: (result.rows ?? []) as T[],
          rowsAffected: result.rowsAffected ?? 0,
        }
      } catch (err) {
        throw toDbError(err, dbName, opts.traceId)
      }
    },
    transaction() {
      throw new DbError({
        category: 'config',
        devMessage:
          '중첩 트랜잭션은 지원하지 않습니다. 단일 transaction 콜백 안에서 모든 query/execute 를 수행하세요.',
      })
    },
  }

  try {
    const result = await fn(tx)
    await conn.commit()
    return result
  } catch (err) {
    try {
      await conn.rollback()
    } catch {
      /* rollback 실패는 원본 에러를 가리지 않도록 무시 */
    }
    if (err instanceof DbError) throw err
    throw toDbError(err, dbName, undefined)
  } finally {
    try {
      await conn.close()
    } catch {
      /* noop */
    }
  }
}

async function oracleClosePool(dbName: string): Promise<void> {
  const store = getPoolStore()
  const p = store.get(dbName)
  if (!p) return
  store.delete(dbName)
  try {
    const pool = await p
    await pool.close(10) // 10초 graceful drain
  } catch {
    /* noop */
  }
}

async function oracleCloseAll(): Promise<void> {
  const store = getPoolStore()
  const entries = Array.from(store.entries())
  store.clear()
  await Promise.all(
    entries.map(async ([, pp]) => {
      try {
        const pool = await pp
        await pool.close(10)
      } catch {
        /* noop */
      }
    }),
  )
}

export const oracleProvider: IDbProvider = {
  query: oracleQuery,
  execute: oracleExecute,
  withTransaction: oracleWithTransaction,
  closePool: oracleClosePool,
  closeAll: oracleCloseAll,
}
