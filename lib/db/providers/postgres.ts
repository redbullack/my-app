/**
 * @module lib/db/providers/postgres
 * @description
 * PostgreSQL 프로바이더 어댑터(node-postgres `pg` 기반). oracle.ts 와 동일한
 * 형태로 `IDbProvider` 를 구현하며, factory 의 ALS 트랜잭션 모델과 1:1 호환된다.
 *
 * 핵심 매핑 (oracledb → pg):
 *   - `oracledb.Pool`              → `pg.Pool`
 *   - `pool.getConnection()`       → `pool.connect()` (PoolClient)
 *   - `conn.execute(sql, binds)`   → `client.query({ text, values, ... })`
 *   - `conn.commit()` / `rollback`→ `client.query('COMMIT' | 'ROLLBACK')`
 *   - `conn.close()`               → `client.release()`
 *   - `conn.close({drop:true})`    → `client.release(err)` (truthy err 전달 → 풀에서 폐기)
 *
 * 동작 차이점에 대한 어댑팅 포인트:
 *  1) **bind 형식**: oracledb 는 named bind(`:name`) 를 native 로 지원하지만, pg 는 positional(`$1`)
 *     만 지원한다. 객체 binds(`Record<string, unknown>`) 가 들어오면 SQL 안의 `:name` 토큰을
 *     `$N` 으로 치환하고 values 배열을 그 순서대로 빌드한다. 문자열 리터럴/주석/PostgreSQL
 *     의 타입 캐스트 연산자 `::` 안에 있는 `:` 는 모두 보존한다. 배열 binds 는 호출자가
 *     pg-native `$1, $2` 로 작성했다고 보고 그대로 통과시킨다.
 *
 *  2) **autoCommit/트랜잭션**: pg 에는 oracledb 의 autoCommit 옵션이 없다. 풀에서 빌린 conn 의
 *     기본 상태는 autocommit (single-statement transaction) 이며, 다중 문장 트랜잭션은
 *     명시적으로 `BEGIN ... COMMIT/ROLLBACK` 을 발급해야 한다. `acquireTxConnection` 단계에서
 *     `BEGIN` 까지 발급하고, commit/rollback 도 SQL 발급으로 처리한다.
 *
 *  3) **per-query timeout**: pg 는 connection 단위 `statement_timeout` 으로만 통제 가능. 매
 *     쿼리마다 `SET LOCAL statement_timeout` (tx 안) 또는 `SET statement_timeout` →
 *     query → `RESET statement_timeout` (tx 밖) 패턴으로 적용. 풀에서 conn 을 빌릴 때마다
 *     상태가 초기화되도록 RESET 도 finally 단계에서 best-effort 로 수행한다.
 *
 *  4) **maxRows**: pg 의 표준 `query()` 는 maxRows 옵션이 없다. cursor/portal 로 partial fetch
 *     하지 않는 한 결과는 모두 클라이언트에 들어온다. 정직한 semantics 를 위해 결과 행을 JS
 *     사이드에서 slice 한다. 큰 결과를 LIMIT 없이 가져오는 코드를 막아주는 안전장치 정도의
 *     의미이며, 네트워크/메모리 비용 절감 효과는 LIMIT 만큼 크지 않다.
 *
 *  5) **destroy(drop)**: pg 는 `client.release(err)` 의 err 가 truthy 면 해당 connection 을 풀에서
 *     꺼내 destroy 한다 — oracledb 의 `close({drop:true})` 와 의미 동일. tx 안전망 발동 시 사용.
 *
 * 풀 캐시는 HMR/다중 import 환경에서의 누수 방지를 위해 globalThis 에 보관한다.
 */

import { Pool } from 'pg'
import type { PoolClient, QueryResultRow, FieldDef } from 'pg'
import type {
  BindParams,
  ExecuteResult,
  IDbProvider,
  PoolOptions,
  InternalQueryOptions,
  QueryResult,
  ResolvedDsn,
} from '../types'
import { DbError, categorizePostgresError } from '../errors'
import { getDbLogger } from '../logger'

/* ─── 풀 캐시 ──────────────────────────────────────────────────────── */

type PoolStore = Map<string, Promise<Pool>>
const GLOBAL_KEY = '__myapp_postgres_pools__'
function getPoolStore(): PoolStore {
  const g = globalThis as unknown as Record<string, PoolStore | undefined>
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = new Map()
  return g[GLOBAL_KEY]!
}

/* ─── DSN 파싱 ─────────────────────────────────────────────────────── */

/**
 * env resolver 가 만들어주는 `connectString` (`host:port/database` 형태) 을
 * pg.Pool 이 받는 host/port/database 로 분해한다.
 * 비정상 입력에 대해서는 즉시 DbError(config) 로 실패시킨다.
 */
function parsePostgresLocation(connectString: string): {
  host: string
  port: number
  database: string
} {
  const slash = connectString.lastIndexOf('/')
  if (slash < 0) {
    throw new DbError({
      category: 'config',
      devMessage: `Postgres connectString 형식 오류 — '/database' 가 없습니다: ${connectString}`,
    })
  }
  const hostPort = connectString.slice(0, slash)
  const database = connectString.slice(slash + 1)
  if (!database) {
    throw new DbError({
      category: 'config',
      devMessage: `Postgres connectString 의 database 가 비어있습니다: ${connectString}`,
    })
  }

  const colon = hostPort.lastIndexOf(':')
  let host: string
  let port: number
  if (colon < 0) {
    host = hostPort
    port = 5432
  } else {
    host = hostPort.slice(0, colon)
    const portStr = hostPort.slice(colon + 1)
    const parsed = Number.parseInt(portStr, 10)
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) {
      throw new DbError({
        category: 'config',
        devMessage: `Postgres connectString 의 port 가 잘못되었습니다: ${portStr}`,
      })
    }
    port = parsed
  }
  if (!host) {
    throw new DbError({
      category: 'config',
      devMessage: `Postgres connectString 의 host 가 비어있습니다: ${connectString}`,
    })
  }
  return { host, port, database }
}

/* ─── bind 변환 (`:name` → `$N`) ───────────────────────────────────── */

/**
 * 객체 binds 를 사용할 때 SQL 안의 `:name` 토큰을 `$N` 으로 치환하고 그 순서대로
 * values 배열을 만든다. 다음 컨텍스트 안의 `:` 는 절대 토큰으로 인식하지 않는다:
 *   - single-quoted 문자열  '...'
 *   - double-quoted 식별자  "..."
 *   - dollar-quoted 문자열  $$...$$ / $tag$...$tag$
 *   - 라인 주석  -- ...
 *   - 블록 주석  /* ... *\/
 *   - PostgreSQL 타입 캐스트 연산자  ::type
 *
 * 같은 이름이 여러 번 등장하면 매번 새로운 `$N` 을 발급하여 values 에 중복 push 한다
 * (단순/안전한 1:1 매핑).
 */
function bindNamedToPositional(
  sql: string,
  binds: Record<string, unknown>,
): { text: string; values: unknown[] } {
  const out: string[] = []
  const values: unknown[] = []
  let i = 0
  const n = sql.length

  while (i < n) {
    const ch = sql[i]
    const next = i + 1 < n ? sql[i + 1] : ''

    // 라인 주석 '-- ... \n'
    if (ch === '-' && next === '-') {
      const eol = sql.indexOf('\n', i + 2)
      const end = eol < 0 ? n : eol + 1
      out.push(sql.slice(i, end))
      i = end
      continue
    }

    // 블록 주석 '/* ... */' (중첩 미지원 — PostgreSQL 표준이 중첩 허용이지만 본 학습 범위 밖)
    if (ch === '/' && next === '*') {
      const close = sql.indexOf('*/', i + 2)
      const end = close < 0 ? n : close + 2
      out.push(sql.slice(i, end))
      i = end
      continue
    }

    // single-quoted 문자열 — '' 이스케이프 처리.
    if (ch === "'") {
      let j = i + 1
      while (j < n) {
        if (sql[j] === "'") {
          if (sql[j + 1] === "'") { j += 2; continue }
          j += 1
          break
        }
        j += 1
      }
      out.push(sql.slice(i, j))
      i = j
      continue
    }

    // double-quoted 식별자 — "" 이스케이프 처리.
    if (ch === '"') {
      let j = i + 1
      while (j < n) {
        if (sql[j] === '"') {
          if (sql[j + 1] === '"') { j += 2; continue }
          j += 1
          break
        }
        j += 1
      }
      out.push(sql.slice(i, j))
      i = j
      continue
    }

    // dollar-quoted 문자열 — $tag$ ... $tag$ 또는 $$ ... $$.
    if (ch === '$') {
      const tagMatch = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i))
      if (tagMatch) {
        const tag = tagMatch[0] // 예: '$$' 또는 '$body$'
        const close = sql.indexOf(tag, i + tag.length)
        const end = close < 0 ? n : close + tag.length
        out.push(sql.slice(i, end))
        i = end
        continue
      }
      // tag 가 아니면 그냥 $ 문자.
      out.push(ch)
      i += 1
      continue
    }

    // 타입 캐스트 '::type' — `:` 가 연속이면 그대로 보존.
    if (ch === ':' && next === ':') {
      out.push('::')
      i += 2
      continue
    }

    // named bind ':identifier'
    if (ch === ':') {
      const idMatch = /^[A-Za-z_][A-Za-z0-9_]*/.exec(sql.slice(i + 1))
      if (idMatch) {
        const name = idMatch[0]
        if (!Object.prototype.hasOwnProperty.call(binds, name)) {
          throw new DbError({
            category: 'syntax',
            devMessage: `Postgres bind 변환 실패 — SQL 의 ':${name}' 에 대응하는 binds 키가 없습니다.`,
          })
        }
        values.push(binds[name])
        out.push(`$${values.length}`)
        i += 1 + name.length
        continue
      }
      // 식별자가 아닌 `:` (예: 시간표기 등) 은 그대로 통과 — 일반적으로 SQL 에서는 거의 없음.
      out.push(ch)
      i += 1
      continue
    }

    out.push(ch)
    i += 1
  }

  return { text: out.join(''), values }
}

function toValues(binds: BindParams, sql: string): { text: string; values: unknown[] } {
  if (Array.isArray(binds)) {
    // 배열 binds 는 pg-native `$1, $2` 로 작성되었다고 가정. SQL 미변환.
    return { text: sql, values: binds.slice() }
  }
  return bindNamedToPositional(sql, binds)
}

/* ─── 타입 매핑 (OID → 우리 표준 type) ──────────────────────────────── */

/**
 * pg-types 의 OID 상수를 직접 import 하지 않고 숫자 리터럴로 둔다 (외부 모듈 의존 최소화).
 * 출처: https://github.com/brianc/node-pg-types/blob/master/lib/builtins.js
 */
const OID = {
  bool: 16,
  int2: 21,
  int4: 23,
  int8: 20,
  float4: 700,
  float8: 701,
  numeric: 1700,
  money: 790,
  date: 1082,
  time: 1083,
  timetz: 1266,
  timestamp: 1114,
  timestamptz: 1184,
} as const

function mapOid(oid: number | undefined): 'string' | 'number' | 'date' {
  switch (oid) {
    case OID.int2:
    case OID.int4:
    case OID.int8:
    case OID.float4:
    case OID.float8:
    case OID.numeric:
    case OID.money:
      return 'number'
    case OID.date:
    case OID.time:
    case OID.timetz:
    case OID.timestamp:
    case OID.timestamptz:
      return 'date'
    default:
      // bool, text, varchar, char, json, jsonb, uuid, bytea 등 모두 'string' 으로 묶는다.
      // (factory 호환 type 셋이 string/number/date 3종이므로 그 외는 string 으로 표현.)
      return 'string'
  }
}

function toColumns(fields: FieldDef[] | undefined): { name: string; type: 'string' | 'number' | 'date' }[] {
  return (fields ?? []).map((f) => ({ name: f.name, type: mapOid(f.dataTypeID) }))
}

/* ─── 풀 생성 ─────────────────────────────────────────────────────── */

async function getPool(
  dbName: string,
  dsn: ResolvedDsn,
  pool: PoolOptions | undefined,
): Promise<Pool> {
  const store = getPoolStore()
  const existing = store.get(dbName)
  if (existing) return existing

  const log = getDbLogger()
  const { host, port, database } = parsePostgresLocation(dsn.connectString)

  // pg.Pool 생성 자체는 동기지만, 실제 첫 connect 까지는 풀이 비어있다.
  // oracle.ts 와의 인터페이스 일치를 위해 Promise<Pool> 로 캐싱한다.
  const created = new Promise<Pool>((resolve, reject) => {
    try {
      const p = new Pool({
        host,
        port,
        database,
        user: dsn.user,
        password: dsn.password,
        min: pool?.min ?? 1,
        max: pool?.max ?? 10,
        // pg 는 idle 종료 시간을 ms 단위로 받는다. timeoutSec=0 이면 무한 idle.
        idleTimeoutMillis: (pool?.timeoutSec ?? 60) * 1000,
        // 풀이 다 차서 새 conn 도 못 만들 때 대기 상한. 기본 무한이라 안전을 위해 30s.
        connectionTimeoutMillis: 30_000,
        application_name: `myapp:${dbName}`,
      })

      // 풀 단위 'error' 이벤트 — idle conn 이 서버 측 종료/네트워크 절단으로 죽을 때 발생.
      // 처리하지 않으면 Node 가 프로세스를 종료시키므로 반드시 listener 부착.
      p.on('error', (err) => {
        log.error('pool.idle_error', {
          db: dbName,
          provider: 'postgres',
          cause: err instanceof Error ? err.message : String(err),
        })
      })

      log.info('pool.created', {
        db: dbName,
        provider: 'postgres',
        min: pool?.min ?? 1,
        max: pool?.max ?? 10,
      })
      resolve(p)
    } catch (err) {
      // 동기 생성 실패 시 캐시에서 제거.
      store.delete(dbName)
      const { category, code } = categorizePostgresError(err)
      reject(
        new DbError({
          category: category === 'unknown' ? 'connection' : category,
          code,
          cause: err,
          devMessage: `Postgres 풀 생성 실패 (db=${dbName})`,
        }),
      )
    }
  })

  store.set(dbName, created)
  return created
}

/* ─── 공통 실행 헬퍼 ─────────────────────────────────────────────── */

function toDbError(err: unknown, dbName: string, traceId: string | undefined): DbError {
  const { category, code } = categorizePostgresError(err)
  return new DbError({
    category,
    code,
    traceId,
    cause: err,
    devMessage: `Postgres 쿼리 실패 (db=${dbName})`,
  })
}

/**
 * 단일 client 위에서 (필요 시 timeout 을 적용하여) 쿼리 1건을 실행한다.
 * - `inTx` = true 면 `SET LOCAL statement_timeout` 으로 트랜잭션 종료 시 자동 복귀.
 * - `inTx` = false 면 SET → 실행 → RESET 패턴으로 conn 의 다음 사용자에 영향 없게 함.
 */
async function runOnClient<T extends QueryResultRow>(
  client: PoolClient,
  sql: string,
  binds: BindParams,
  opts: InternalQueryOptions,
  inTx: boolean,
): Promise<{ rows: T[]; rowsAffected: number; fields: FieldDef[] | undefined }> {
  const { text, values } = toValues(binds, sql)

  if (typeof opts.timeoutMs === 'number' && opts.timeoutMs > 0) {
    const setStmt = inTx ? 'SET LOCAL statement_timeout = $1' : 'SET statement_timeout = $1'
    await client.query(setStmt, [opts.timeoutMs])
  }

  try {
    const result = await client.query<T>({ text, values })
    let rows = result.rows
    if (typeof opts.maxRows === 'number' && opts.maxRows >= 0 && rows.length > opts.maxRows) {
      rows = rows.slice(0, opts.maxRows)
    }
    return {
      rows,
      // pg 는 SELECT 의 rowCount 도 채워주므로 그대로 노출. null 인 경우 0.
      rowsAffected: result.rowCount ?? 0,
      fields: result.fields,
    }
  } finally {
    // tx 밖에서만 RESET — tx 안의 SET LOCAL 은 트랜잭션 종료 시 자동 복귀하므로 불필요.
    if (!inTx && typeof opts.timeoutMs === 'number' && opts.timeoutMs > 0) {
      try {
        await client.query('RESET statement_timeout')
      } catch {
        /* RESET 실패는 무시 — 풀 반납 단계에서 conn 이 폐기되거나 다음 SET 으로 덮어쓸 수 있다. */
      }
    }
  }
}

/* ─── IDbProvider 구현체 ─────────────────────────────────────────── */

async function postgresQuery<T>(
  dbName: string,
  dsn: ResolvedDsn,
  pool: PoolOptions | undefined,
  sql: string,
  binds: BindParams,
  opts: InternalQueryOptions,
): Promise<QueryResult<T>> {
  // 트랜잭션 컨텍스트에서 전달된 raw client 가 있으면 풀에서 빌리지 않고 그 위에서 실행.
  if (opts.conn) {
    const client = opts.conn as PoolClient
    try {
      const r = await runOnClient<QueryResultRow>(client, sql, binds, opts, true)
      return { columns: toColumns(r.fields), rows: r.rows as unknown as T[] }
    } catch (err) {
      throw toDbError(err, dbName, opts.traceId)
    }
  }

  const p = await getPool(dbName, dsn, pool)
  const client = await p.connect()
  try {
    const r = await runOnClient<QueryResultRow>(client, sql, binds, opts, false)
    return { columns: toColumns(r.fields), rows: r.rows as unknown as T[] }
  } catch (err) {
    throw toDbError(err, dbName, opts.traceId)
  } finally {
    try {
      client.release()
    } catch {
      /* 풀 반납 실패는 무시 — pg 가 내부적으로 회수한다. */
    }
  }
}

async function postgresExecute<T>(
  dbName: string,
  dsn: ResolvedDsn,
  pool: PoolOptions | undefined,
  sql: string,
  binds: BindParams,
  opts: InternalQueryOptions,
): Promise<ExecuteResult<T>> {
  if (opts.conn) {
    const client = opts.conn as PoolClient
    try {
      const r = await runOnClient<QueryResultRow>(client, sql, binds, opts, true)
      return { rows: r.rows as unknown as T[], rowsAffected: r.rowsAffected }
    } catch (err) {
      throw toDbError(err, dbName, opts.traceId)
    }
  }

  const p = await getPool(dbName, dsn, pool)
  const client = await p.connect()
  try {
    const r = await runOnClient<QueryResultRow>(client, sql, binds, opts, false)
    return { rows: r.rows as unknown as T[], rowsAffected: r.rowsAffected }
  } catch (err) {
    throw toDbError(err, dbName, opts.traceId)
  } finally {
    try {
      client.release()
    } catch {
      /* noop */
    }
  }
}

/**
 * 트랜잭션용 client 를 풀에서 빌리고 즉시 `BEGIN` 까지 발급한다.
 *
 * 만약 `BEGIN` 자체가 실패하면 풀에 잘못된 상태로 돌려보내지 않기 위해 destroy 한 뒤 throw.
 * 정상 케이스에서 반환된 PoolClient 는 factory 의 ALS state.conn 으로 보관되어 이후의
 * query/execute/commit/rollback/release/destroy 호출에 사용된다.
 */
async function postgresAcquireTxConnection(
  dbName: string,
  dsn: ResolvedDsn,
  pool: PoolOptions | undefined,
): Promise<unknown> {
  const p = await getPool(dbName, dsn, pool)
  const client = await p.connect()
  try {
    await client.query('BEGIN')
    return client
  } catch (err) {
    try {
      // 풀로 되돌리지 않고 destroy.
      client.release(err instanceof Error ? err : new Error(String(err)))
    } catch {
      /* noop */
    }
    throw toDbError(err, dbName, undefined)
  }
}

async function postgresCommit(conn: unknown): Promise<void> {
  const client = conn as PoolClient
  await client.query('COMMIT')
}

async function postgresRollback(conn: unknown): Promise<void> {
  const client = conn as PoolClient
  await client.query('ROLLBACK')
}

async function postgresRelease(conn: unknown): Promise<void> {
  try {
    ;(conn as PoolClient).release()
  } catch {
    /* noop */
  }
}

/**
 * 풀로 반납하지 않고 client 를 폐기한다.
 * pg 는 `release(err)` 에 truthy err 를 넘기면 해당 client 를 풀에서 빼낸 뒤 destroy 한다.
 * tx 안전망(await 누락 / aborted)이 발동된 경우만 호출된다.
 */
async function postgresDestroy(conn: unknown): Promise<void> {
  try {
    ;(conn as PoolClient).release(new Error('myapp:tx-destroyed'))
  } catch {
    /* noop */
  }
}

/**
 * 풀을 선제 생성. pg 풀은 lazy 라 connect 를 한 번 해줘야 실제 conn 이 만들어진다.
 * 워밍업 단계에서 `poolMin` 만큼 미리 채워두기 위해, min 만큼의 connect/release 를 병렬 수행.
 */
async function postgresWarmup(
  dbName: string,
  dsn: ResolvedDsn,
  pool: PoolOptions | undefined,
): Promise<void> {
  const p = await getPool(dbName, dsn, pool)
  const min = Math.max(1, pool?.min ?? 1)
  const clients = await Promise.all(Array.from({ length: min }, () => p.connect()))
  for (const c of clients) {
    try {
      c.release()
    } catch {
      /* noop */
    }
  }
}

async function postgresClosePool(dbName: string): Promise<void> {
  const store = getPoolStore()
  const p = store.get(dbName)
  if (!p) return
  store.delete(dbName)
  try {
    const pool = await p
    await pool.end()
  } catch {
    /* noop */
  }
}

async function postgresCloseAll(): Promise<void> {
  const store = getPoolStore()
  const entries = Array.from(store.entries())
  store.clear()
  await Promise.all(
    entries.map(async ([, pp]) => {
      try {
        const pool = await pp
        await pool.end()
      } catch {
        /* noop */
      }
    }),
  )
}

export const postgresProvider: IDbProvider = {
  query: postgresQuery,
  execute: postgresExecute,
  acquireTxConnection: postgresAcquireTxConnection,
  commit: postgresCommit,
  rollback: postgresRollback,
  release: postgresRelease,
  destroy: postgresDestroy,
  warmup: postgresWarmup,
  closePool: postgresClosePool,
  closeAll: postgresCloseAll,
}
