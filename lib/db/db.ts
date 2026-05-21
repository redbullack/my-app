/**
 * @module lib/db
 * @description
 * 사내 개발자 사용성 우선 DB 진입점 — provider 추상화 레이어를 두지 않고
 * 본 파일 안에서 `switch (providerName)` 로 oracle / postgres 를 직접 분기한다.
 *
 * 호출 흐름:
 *   const db = getDb({ name: 'MAIN' })
 *
 *   // 트랜잭션 미사용 (isTransaction=false, 기본)
 *   const r = await db.run(async (agent) => {
 *     return agent.execute<User>('SELECT * FROM users WHERE id = :id', { id: 1 })
 *   })
 *
 *   // 트랜잭션 사용 (isTransaction=true, 콜백 성공 시 commit, throw 시 rollback)
 *   const db2 = getDb({ name: 'MAIN', isTransaction: true })
 *   await db2.run(async (agent) => {
 *     await agent.execute('UPDATE accounts SET bal = bal - :v WHERE id = :id', { v: 100, id: 1 })
 *     await agent.execute('UPDATE accounts SET bal = bal + :v WHERE id = :id', { v: 100, id: 2 })
 *   })
 *
 * execute 한 가지로 SELECT/INSERT/UPDATE/DELETE 모두 처리한다.
 * 반환 타입은 공통 `QueryResult` — SELECT 면 columns/rows 가 채워지고,
 * 그 외 DML 이면 affectedCount 가 채워진다.
 */

import path from 'node:path'
import { inspect } from 'node:util'
import oracledb from 'oracledb'
import { Pool as PgPool, type PoolClient as PgClient } from 'pg'
import { insertLogQuery } from './logger-new'
import { resolveFromEnv, type ProviderName } from './envResolver'
import type { Session } from 'next-auth'
import { auth } from '@/lib/auth/auth'

// ─── Oracle Thick 모드 초기화 ───────────────────────────────────────
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
  name?: string
  isTransaction?: boolean
  isUserRequierd?: boolean
}

export interface DbAgent {
  execute<T = Record<string, unknown>>(sql: string, binds?: BindParams): Promise<QueryResult<T>>
}

export interface DbClient {
  run<R>(fn: (dbAgent: DbAgent, userInfo?: Session) => Promise<R>): Promise<R>
}

/**
 * provider 분기는 DbDriver 한 군데로 몰아둔다. 풀 자체를 캐싱하지 않고
 * DbDriver(=풀을 클로저로 캡처한 ops 묶음) 를 캐싱한다.
 */
export type DbDriver = {
  readonly provider: ProviderName
  getConnection(): Promise<unknown>
  release(conn: unknown): Promise<void>
  begin(conn: unknown): Promise<void>
  commit(conn: unknown): Promise<void>
  rollback(conn: unknown): Promise<void>
  closePool(drainSec?: number): Promise<void>
  rawExecute<T>(conn: unknown, sql: string, binds: BindParams, autoCommit: boolean): Promise<QueryResult<T>>
}

// ─── DbDriver 캐시 (HMR-safe) ───────────────────────────────────────
const DRIVER_CACHE_KEY = '__myapp_db_driver_cache__'
function getDriverCache(): Map<string, DbDriver> {
  const g = globalThis as unknown as Record<string, Map<string, DbDriver> | undefined>
  if (!g[DRIVER_CACHE_KEY]) g[DRIVER_CACHE_KEY] = new Map()
  return g[DRIVER_CACHE_KEY]!
}

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
  if ([20, 21, 23, 700, 701, 1700].includes(oid)) return 'number'
  if ([1082, 1083, 1114, 1184, 1266].includes(oid)) return 'date'
  return 'string'
}

export async function getDbDriver(name: string): Promise<DbDriver> {
  const cache = getDriverCache()
  const cached = cache.get(name)
  if (cached) return cached

  const envResult = resolveFromEnv(name)
  if (!envResult) throw new Error(`환경변수 DB_CONNECTION__${name} 이 설정되지 않았습니다`)

  let driver: DbDriver
  switch (envResult.providerName) {
    case 'oracle': {
      const startAt = Date.now(); console.log(`TEST - db.ts - ensureOracleThick 시작`)
      ensureOracleThick()
      const endAt = Date.now(); console.log(`TEST - db.ts - ensureOracleThick 끝 (${endAt - startAt})`)

      const startAt2 = Date.now(); console.log(`TEST - db.ts - oracledb.createPool 시작`)
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
      const endAt2 = Date.now(); console.log(`TEST - db.ts - oracledb.createPool 끝 (${endAt2 - startAt2})`)

      driver = {
        provider: 'oracle',
        getConnection: () => pool.getConnection(),
        release: async (conn) => { try { await (conn as oracledb.Connection).close() } catch {} },
        begin: async () => {}, // oracle 은 명시적 BEGIN 이 없다 (autoCommit=false 면 트랜잭션 진행 중)
        commit: (conn) => (conn as oracledb.Connection).commit(),
        rollback: (conn) => (conn as oracledb.Connection).rollback(),
        closePool: async (drainSec) => { try { await pool.close(drainSec ?? 10) } catch {} },
        async rawExecute<T>(conn: unknown, sql: string, binds: BindParams, autoCommit: boolean) {
          const r = await (conn as oracledb.Connection).execute<T>(
            sql, binds as oracledb.BindParameters,
            { autoCommit, outFormat: oracledb.OUT_FORMAT_OBJECT },
          )
          const columns = (r.metaData ?? []).map((m) => ({
            name: m.name,
            type: mapOracleColType(m.fetchType ?? (m.dbType as oracledb.DbType | undefined)),
          }))
          return {
            columns,
            rows: (r.rows ?? []) as T[],
            affectedCount: r.rowsAffected ?? 0,
          }
        },
      }
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
      driver = {
        provider: 'postgres',
        getConnection: () => pool.connect(),
        release: async (conn) => { try { (conn as PgClient).release() } catch {} },
        begin: async (conn) => { await (conn as PgClient).query('BEGIN') },
        commit: async (conn) => { await (conn as PgClient).query('COMMIT') },
        rollback: async (conn) => { await (conn as PgClient).query('ROLLBACK') },
        closePool: async () => { try { await pool.end() } catch {} },
        async rawExecute<T>(conn: unknown, sql: string, binds: BindParams) {
          const r = await (conn as PgClient).query<T extends Record<string, unknown> ? T : never>(
            sql, binds as unknown[],
          )
          const columns = r.fields.map((f) => ({
            name: f.name,
            type: mapPgColType(f.dataTypeID),
          }))
          return {
            columns,
            rows: r.rows as T[],
            affectedCount: r.rowCount ?? 0,
          }
        },
      }
      break
    }
    default: throw new Error(`지원하지 않는 provider: ${envResult.providerName}`)
  }

  cache.set(name, driver)
  return driver
}

// ─── 에이전트 ───────────────────────────────────────────────────────
function createDbAgent(
  driver: DbDriver, conn: unknown, autoCommit: boolean, dbName: string,
  userInfo: Session | undefined,
): DbAgent {
  return {
    /** SELECT/INSERT/UPDATE/DELETE 모두 처리. SELECT 면 rows, 그 외엔 affectedCount 가 채워진다. */
    async execute<T = Record<string, unknown>>(sql: string, binds: BindParams = {}): Promise<QueryResult<T>> {
      const startedAt = new Date(Date.now())
      try {
        const result = await driver.rawExecute<T>(conn, sql, binds, autoCommit)
        const rowCount = result.rows.length > 0 ? result.rows.length : result.affectedCount
        void insertLogQuery({
          dbDriver: await getDbDriver('MAIN'),
          db: dbName, provider: driver.provider, sql,
          startedAt, endedAt: new Date(Date.now()),
          rowCount, userInfo,
        })
        return result
      } catch (err) {
        void insertLogQuery({
          dbDriver: await getDbDriver('MAIN'),
          db: dbName, provider: driver.provider, sql,
          startedAt, endedAt: new Date(Date.now()),
          errorDesc: inspect(err, { depth: null, breakLength: Infinity, maxStringLength: Infinity }),
          userInfo,
        })
        throw err
      }
    },
  }
}

// 호출부에서 사용하는 getDb()
export function getDb( { name = 'MAIN', isTransaction = false, isUserRequierd = true } : DbInfo = { name: 'MAIN', isTransaction: false, isUserRequierd: true }): DbClient {
  return {
    async run<R>(fn: (dbAgent: DbAgent, userInfo?: Session) => Promise<R>): Promise<R> {
      const driver = await getDbDriver(name)

      const userInfo: Session | undefined = isUserRequierd ? (await auth()) ?? undefined : undefined
      if (isUserRequierd && !userInfo?.user.id) throw new Error(`해당 쿼리는 사용자 정보를 요구하지만 누락되었습니다.`)

      const startAt3 = Date.now(); console.log(`TEST - db.ts - driver.getConnection 시작`)
      const conn = await driver.getConnection()
      const endAt3 = Date.now(); console.log(`TEST - db.ts - driver.getConnection 끝 (${endAt3 - startAt3})`)
      
      try {
        if (!isTransaction) {
          return await fn(createDbAgent(driver, conn, true, name, userInfo), userInfo)
        }
        await driver.begin(conn)
        try {
          const result = await fn(createDbAgent(driver, conn, false, name, userInfo), userInfo)
          await driver.commit(conn)
          return result
        } catch (err) {
          try { await driver.rollback(conn) } catch { /* noop */ }
          throw err
        }
      } finally {
        await driver.release(conn)
      }
    },
  }
}

export async function warmupDb(name: string): Promise<void> {
  await getDbDriver(name)
}
