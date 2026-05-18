/**
 * @module lib/db
 * @description
 * 사내 개발자 사용성 우선 DB 진입점 — provider 추상화 레이어를 두지 않고
 * 본 파일 안에서 `switch (providerName)` 로 oracle / postgres 를 직접 분기한다.
 *
 * 호출 흐름:
 *   const db = getDb({ name: 'MAIN' })
 *
 *   // 트랜잭션 미사용
 *   const r = await db.run(async (agent) => {
 *     return agent.fill<User>('SELECT * FROM users WHERE id = :id', { id: 1 })
 *   })
 *   // r.columns / r.rows / r.affectedCount (=0)
 *
 *   // 트랜잭션 사용 (콜백 성공 시 commit, throw 시 rollback)
 *   await db.runTx(async (agent) => {
 *     await agent.execute('UPDATE accounts SET bal = bal - :v WHERE id = :id', { v: 100, id: 1 })
 *     await agent.execute('UPDATE accounts SET bal = bal + :v WHERE id = :id', { v: 100, id: 2 })
 *   })
 *
 * 반환 타입은 fill / execute 모두 공통 `QueryResult` 한 가지로 통일한다.
 *  - fill:    columns/rows 채움, affectedCount = 0
 *  - execute: columns/rows = [], affectedCount = 영향 행 수
 */

import path from 'node:path'
import { inspect } from 'node:util'
import oracledb from 'oracledb'
import { Pool as PgPool, type PoolClient as PgClient } from 'pg'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { insertLogQuery } from './logger-new'
import { resolveFromEnv, type ProviderName } from './envResolver'
import { getRequestCtx, type RequestCtx } from '../utils/server/requestContext'

dayjs.extend(utc)

// ─── Oracle Thick 모드 초기화 ───────────────────────────────────────
/**
 * oracledb 는 기본 thin 모드로 동작하나, 사내 환경에서는 Instant Client 기반 thick 모드를
 * 사용한다(전사 표준 NLS/암호화 설정 호환). 프로세스당 1회만 초기화되어야 하므로
 * globalThis 플래그로 가드한다 — Next.js dev HMR 로 모듈이 재평가되어도 중복 init 을 피한다.
 */
const THICK_INIT_KEY = '__myapp_oracle_thick_initialized__'
function ensureOracleThick(): void {
  const g = globalThis as unknown as Record<string, boolean | undefined>
  if (g[THICK_INIT_KEY]) return

  const libDir = path.resolve(process.cwd(), 'vendor/instantclient/instantclient_21_20')
  try {
    oracledb.initOracleClient({ libDir })
    g[THICK_INIT_KEY] = true
    console.log('oracle.thick.initialized', {
      libDir,
      clientVersion: oracledb.oracleClientVersionString,
    })
  } catch (err) {
    throw new Error(
      `Oracle Thick 모드 초기화 실패 — libDir=${libDir}. Instant Client 설치 또는 ORACLE_CLIENT_LIB_DIR 를 확인하세요.`,
      { cause: err },
    )
  }
}

export type BindParams = Record<string, unknown> | unknown[]

export type ColumnType = 'string' | 'number' | 'date'

export type QueryResult<T = Record<string, unknown>> = {
  columns: { name: string; type: ColumnType }[]
  rows: T[]
  affectedCount: number
}

export type DbInfo = {
    name: string
    allowUserInfo: boolean
}

export interface DbAgent {
  fill<T = Record<string, unknown>>(sql: string, binds?: BindParams): Promise<QueryResult<T>>
  execute<T = Record<string, unknown>>(sql: string, binds?: BindParams): Promise<QueryResult<T>>
}

export interface DbClient {
  run<R>(fn: (dbAgent: DbAgent, userInfo?: RequestCtx) => Promise<R>): Promise<R>
  runTx<R>(fn: (dbAgent: DbAgent, userInfo?: RequestCtx) => Promise<R>): Promise<R>
}

// ─── 풀 캐시 (provider 별로 같은 Map 에 보관, key 는 dbName) ────────
export type CachedPool =
  | { provider: 'oracle'; pool: oracledb.Pool }
  | { provider: 'postgres'; pool: PgPool }

/**
 * HMR-safe 풀 저장소. Next.js dev 환경에서 모듈이 재평가되어도 풀이 누수되지 않도록
 * globalThis 에 보관한다. 운영(빌드 결과) 에서도 동일 동작 — 단일 인스턴스 내에서 1개만 존재.
 */
const POOL_CACHE_KEY = '__myapp_db_pool_cache__'
function getPoolCache(): Map<string, CachedPool> {
  const g = globalThis as unknown as Record<string, Map<string, CachedPool> | undefined>
  if (!g[POOL_CACHE_KEY]) g[POOL_CACHE_KEY] = new Map()
  return g[POOL_CACHE_KEY]!
}

// async function getPool(name: string): Promise<{ envResult: EnvResolveResult; cachedPool: CachedPool }> {
export async function getPool(name: string): Promise<CachedPool> {
  const envResult = resolveFromEnv(name)
  if (!envResult) throw new Error(`환경변수 DB_CONNECTION__${name} 이 설정되지 않았습니다`)

  const poolCache = getPoolCache()
  const cachedPool = poolCache.get(name)
//   if (cachedPool) return { envResult, cachedPool }
  if (cachedPool) return cachedPool

  let createdPool: CachedPool
  switch (envResult.providerName) {
    case 'oracle': {
      ensureOracleThick()
      const pool = await oracledb.createPool({
        user: envResult.dsn.user,
        password: envResult.dsn.password,
        connectString: envResult.dsn.connectString,
        poolMin: envResult.pool.min ?? 100,
        poolMax: envResult.pool.max ?? 1000,
        poolIncrement: envResult.pool.increment ?? 10,
        poolTimeout: envResult.pool.timeout ?? 60,
        queueTimeout: envResult.pool.queueTimeout ?? 3000,
        poolAlias: name,
      })
      createdPool = { provider: envResult.providerName, pool }
      break
    }
    case 'postgres': {
      const [host, portDb] = envResult.dsn.connectString.split(':')
      const [portStr, database] = (portDb ?? '').split('/')
      const pool = new PgPool({
        host,
        port: parseInt(portStr, 10) || 5432,
        database,
        user: envResult.dsn.user,
        password: envResult.dsn.password,
        min: envResult.pool.min ?? 10,
        max: envResult.pool.max ?? 200,
        idleTimeoutMillis: (envResult.pool.timeout ?? 60) * 1000,
        connectionTimeoutMillis: envResult.pool.queueTimeout ?? 3000,
      })
      createdPool = { provider: envResult.providerName, pool }
      break
    }
    // default: {
    //   const _exhaustive: never = envResult.providerName
    //   throw new Error(`지원하지 않는 provider: ${_exhaustive as string}`)
    // }
    default: throw new Error(`지원하지 않는 provider: ${envResult.providerName}`)
  }

  poolCache.set(name, createdPool)
//   return { envResult, cachedPool: createdPool }
  return createdPool
}

// ─── 바인드/타입 매핑 헬퍼 ──────────────────────────────────────────

/** oracledb.DB_TYPE_* 는 DbType 객체이므로 `.num` 으로 비교한다. */
const ORACLE_NUMBER_TYPES = new Set<number>([
  oracledb.DB_TYPE_NUMBER.num,
  oracledb.DB_TYPE_BINARY_FLOAT.num,
  oracledb.DB_TYPE_BINARY_DOUBLE.num,
])
const ORACLE_DATE_TYPES = new Set<number>([
  oracledb.DB_TYPE_DATE.num,
  oracledb.DB_TYPE_TIMESTAMP.num,
  oracledb.DB_TYPE_TIMESTAMP_TZ.num,
  oracledb.DB_TYPE_TIMESTAMP_LTZ.num,
])

function mapOracleColType(fetchType: number | oracledb.DbType | undefined): ColumnType {
  const n = typeof fetchType === 'number' ? fetchType : fetchType?.num
  if (n == null) return 'string'
  if (ORACLE_NUMBER_TYPES.has(n)) return 'number'
  if (ORACLE_DATE_TYPES.has(n)) return 'date'
  return 'string'
}

/** pg 의 dataTypeID(oid) → ColumnType. 자주 쓰는 것만 매핑하고 나머지는 'string'. */
function mapPgColType(oid: number): ColumnType {
  // 숫자: int2(21) int4(23) int8(20) float4(700) float8(701) numeric(1700)
  if ([20, 21, 23, 700, 701, 1700].includes(oid)) return 'number'
  // 날짜/시각: date(1082) time(1083) timestamp(1114) timestamptz(1184) timetz(1266)
  if ([1082, 1083, 1114, 1184, 1266].includes(oid)) return 'date'
  return 'string'
}

// ─── Provider Ops ───────────────────────────────────────────────────
/**
 * provider 분기는 본 함수 한 군데로 몰아둔다. 반환된 `ops` 는 conn 을 불투명하게
 * 다루는 호출자(run/runTx) 가 lifecycle 만 제어하고, 실제 쿼리/트랜잭션 동작은
 * 여기서 캡처한 클로저가 수행한다.
 *
 * Conn 타입은 `unknown` 으로 유지한다 — 같은 ops 가 만든 conn 이 같은 ops 로 되돌아오는
 * 닫힌 흐름이라 외부 캐스팅이 필요 없고, union 타입을 만들면 매 호출마다 가드가 필요해진다.
 */
type CommandType = 'fill' | 'execute'
type ProviderOption = {
  getConnection(): Promise<unknown>
  release(c: unknown): Promise<void>
  begin(c: unknown): Promise<void>
  commit(c: unknown): Promise<void>
  rollback(c: unknown): Promise<void>
  rawExecute<T>(c: unknown, op: CommandType, sql: string, binds: BindParams, autoCommit: boolean): Promise<QueryResult<T>>
}

export function getProviderOption(cached: CachedPool): ProviderOption {
  switch (cached.provider) {
    case 'oracle': {
      const pool = cached.pool
      return {
        getConnection: () => pool.getConnection(),
        release: async (c) => { try { await (c as oracledb.Connection).close() } catch {} },
        begin: async () => {}, // oracle 은 명시적 BEGIN 이 없다 (autoCommit=false 면 트랜잭션 진행 중)
        commit: (c) => (c as oracledb.Connection).commit(),
        rollback: (c) => (c as oracledb.Connection).rollback(),
        async rawExecute<T>(c: unknown, commandType: CommandType, sql: string, binds: BindParams, autoCommit: boolean) {
          const r = await (c as oracledb.Connection).execute<T>(
            sql, binds as oracledb.BindParameters,
            { autoCommit, outFormat: oracledb.OUT_FORMAT_OBJECT },
          )
          if (commandType === 'fill') {
            const columns = (r.metaData ?? []).map((m) => ({
              name: m.name,
              type: mapOracleColType(m.fetchType ?? (m.dbType as oracledb.DbType | undefined)),
            }))
            return { columns, rows: (r.rows ?? []) as T[], affectedCount: 0 }
          }
          return { columns: [], rows: [], affectedCount: r.rowsAffected ?? 0 }
        },
      }
    }
    case 'postgres': {
      const pool = cached.pool
      return {
        getConnection: () => pool.connect(),
        release: async (c) => { try { (c as PgClient).release() } catch {} },
        begin: async (c) => { await (c as PgClient).query('BEGIN') },
        commit: async (c) => { await (c as PgClient).query('COMMIT') },
        rollback: async (c) => { await (c as PgClient).query('ROLLBACK') },
        async rawExecute<T>(c: unknown, commandType: CommandType, sql: string, binds: BindParams) {
        //   const { text, values } = toPgQuery(sql, binds)
          const r = await (c as PgClient).query<T extends Record<string, unknown> ? T : never>(sql, binds as unknown[])
          if (commandType === 'fill') {
            const columns = r.fields.map((f) => ({
                name: f.name,
                // type: mapPgColType(f.dataTypeID) 
                type: [1082, 1083, 1114, 1184, 1266].includes(f.dataTypeID) ? 'date' : 
                      [20, 21, 23, 700, 701, 1700].includes(f.dataTypeID) ? 'number' : 'string' as ColumnType
            }))
            return { columns, rows: r.rows as T[], affectedCount: 0 }
          }
          return { columns: [], rows: [], affectedCount: r.rowCount ?? 0 }
        },
      }
    }
  }
}

// ─── 에이전트 ───────────────────────────────────────────────────────
const nowKst = () => dayjs().utcOffset(9 * 60).format('YYYY-MM-DDTHH:mm:ss.SSSZ')

function createDbAgent(
  providerOp: ProviderOption, conn: unknown, autoCommit: boolean,
  dbName: string, provider: ProviderName,
): DbAgent {
  return {
    /** SELECT 류 — columns/rows 채움, affectedCount = 0. */
    async fill<T = Record<string, unknown>>(sql: string, binds: BindParams = {}): Promise<QueryResult<T>> {
      const startedAt = nowKst()
      try {
        const result = await providerOp.rawExecute<T>(conn, 'fill', sql, binds, autoCommit)
        void insertLogQuery({
          db: dbName, provider, op: 'fill', sql, startedAt, endedAt: nowKst(),
          rowCount: result.rows.length,
        })
        return result
      } catch (err) {
        void insertLogQuery({
          db: dbName, provider, op: 'fill', sql, startedAt, endedAt: nowKst(),
          errorDesc: inspect(err, { depth: null, breakLength: Infinity, maxStringLength: Infinity }),
        })
        throw err
      }
    },

    /** INSERT/UPDATE/DELETE 류 — columns/rows = [], affectedCount 만 채움. */
    async execute<T = Record<string, unknown>>(sql: string, binds: BindParams = {}): Promise<QueryResult<T>> {
      const startedAt = nowKst()
      try {
        const result = await providerOp.rawExecute<T>(conn, 'execute', sql, binds, autoCommit)
        void insertLogQuery({
          db: dbName, provider, op: 'execute', sql, startedAt, endedAt: nowKst(),
          rowCount: result.affectedCount,
        })
        return result
      } catch (err) {
        void insertLogQuery({
          db: dbName, provider, op: 'execute', sql, startedAt, endedAt: nowKst(),
          errorDesc: inspect(err, { depth: null, breakLength: Infinity, maxStringLength: Infinity }),
        })
        throw err
      }
    },
  }
}

// 호출부에서 사용하는 getDb()
export function getDb(dbInfo: DbInfo = { name: 'MAIN', allowUserInfo: true }): DbClient {
  return {
    /** 트랜잭션 미사용. 콜백 동안 단일 커넥션 점유, 각 쿼리는 autoCommit. */
    async run<R>(fn: (dbAgent: DbAgent, userInfo?: RequestCtx) => Promise<R>): Promise<R> {
      const cachedPool = await getPool(dbInfo.name)
      const providerOp = getProviderOption(cachedPool)
      const conn = await providerOp.getConnection()
      try {
        return await fn(createDbAgent(providerOp, conn, true, dbInfo.name, cachedPool.provider), dbInfo.allowUserInfo ? await getRequestCtx() : undefined)
      } finally {
        await providerOp.release(conn)
      }
    },

    /** 트랜잭션 사용. 콜백 성공 시 commit, throw 시 rollback. */
    async runTx<R>(fn: (dbAgent: DbAgent, userInfo?: RequestCtx) => Promise<R>): Promise<R> {
      const cachedPool = await getPool(dbInfo.name)
      const providerOp = getProviderOption(cachedPool)
      const conn = await providerOp.getConnection()
      try {
        await providerOp.begin(conn)
        const result = await fn(createDbAgent(providerOp, conn, false, dbInfo.name, cachedPool.provider), dbInfo.allowUserInfo ? await getRequestCtx() : undefined)
        await providerOp.commit(conn)
        return result
      } catch (err) {
        try { await providerOp.rollback(conn) } catch { /* noop */ }
        throw err
      } finally {
        await providerOp.release(conn)
      }
    },
  }
}

export async function warmupDb(name: string): Promise<void> {
  await getPool(name)
}

// ─── 종료 훅 ────────────────────────────────────────────────────────
// const HOOK_FLAG = '__myapp_db_exit_hook__'
// const g = globalThis as unknown as Record<string, boolean | undefined>
// if (!g[HOOK_FLAG]) {
//   g[HOOK_FLAG] = true
//   const close = async () => {
//     for (const [, c] of poolCache) {
//       try {
//         if (c.provider === 'oracle') await c.pool.close(10)
//         else await c.pool.end()
//       } catch { /* noop */ }
//     }
//   }
//   process.once('beforeExit', close)
//   process.once('SIGINT', close)
//   process.once('SIGTERM', close)
// }

// ─── 미사용 import 가드 (타입 위치 보존용) ──────────────────────────
// export type { ProviderName }


/**
 * oracle 의 `:name` 바인드 SQL 을 postgres 의 `$1, $2, ...` 로 변환한다.
 * 같은 네임드 파라미터가 여러 번 등장하면 같은 위치 번호를 재사용한다.
 * 호출자가 이미 배열(BindParams = unknown[]) 을 넘긴 경우 SQL 은 그대로 둔다.
 */
// function toPgQuery(sql: string, binds: BindParams): { text: string; values: unknown[] } {
//   if (Array.isArray(binds)) return { text: sql, values: binds }

//   const order: string[] = []
//   const text = sql.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_m, key: string) => {
//     let idx = order.indexOf(key)
//     if (idx < 0) { order.push(key); idx = order.length - 1 }
//     return `$${idx + 1}`
//   })
//   const values = order.map((k) => (binds as Record<string, unknown>)[k])
//   return { text, values }
// }