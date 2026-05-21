/**
 * @module lib/db/db-new
 * @description
 * 
 * 호출:
 * const db = getDb({ name: 'MAIN' })
 * const r  = await db.run(async (agent) => agent.execute('SELECT * FROM emp WHERE empno=:n', { n: 7369 }))
 */

import path from 'node:path'
import oracledb from 'oracledb'
import { Pool as PgPool, type PoolClient as PgClient } from 'pg'
import type { Session } from 'next-auth'
import { auth } from '@/lib/auth/auth' // auth.ts

// 타입 
export type BindParams = Record<string, unknown> | unknown[]
export type ColumnType = 'string' | 'number' | 'date' | 'bool'
export type DbResult<T = Record<string, unknown>> = {
    columns: { name: string; type: ColumnType }[]
    rows: T[]
    affectedCount: number
}

export type DbClient = {
    execute<T = Record<string, unknown>>(sql: string, binds?: BindParams): Promise<DbResult<T>>
}
export type Db = {
    run<R>(callback: (dbClient: DbClient, userInfo?: Session) => Promise<R>): Promise<R>
}
export type DbInfo = {
    name?: string
    isTransaction?: boolean
    isUserLess?: boolean
}

type OracleConfig = {
    providerName: 'oracle'
    connectString: string
    user: string
    password: string
    poolMin?: number
    poolMax?: number
    poolIncrement?: number
    poolTimeout?: number
    queueTimeout?: number
}
type PgConfig = {
    providerName: 'postgres'
    host: string
    port: number
    database: string
    user: string
    password: string
    min?: number
    max?: number
    idleTimeoutMillis?: number
    connectionTimeoutMillis?: number
}
type DbConfig = OracleConfig | PgConfig

// const poolStore = new Map<string, oracledb.Pool | PgPool>()
// let isOracleThickInitialized = false

// 풀 캐시 / Oracle Thick 모드 초기화
// 운영 환경(노드 프로세스 = 인스턴스 1개)에서는 모듈 스코프 변수로 충분하다.
// HMR-safe 가 필요해지면 globalThis 버전으로 되돌린다.

// 풀 캐시
const POOL_CACHE_KEY = '__myapp_db_pool_cache__'
type PoolStore = Map<string, oracledb.Pool | PgPool>
function getPoolStore(): PoolStore {
    const g = globalThis as unknown as Record<string, PoolStore | undefined>
    if (!g[POOL_CACHE_KEY]) g[POOL_CACHE_KEY] = new Map()
    return g[POOL_CACHE_KEY]!
}

// Oracle Thick 모드 초기화
const THICK_INIT_KEY = '__myapp_oracle_thick_initialized__'
function ensureOracleThick(): void {
    const g = globalThis as unknown as Record<string, boolean | undefined>
    if (g[THICK_INIT_KEY]) return
    const libDir = path.resolve(process.cwd(), 'vendor/instantclient/instantclient_21_20')
    oracledb.initOracleClient({ libDir })
    g[THICK_INIT_KEY] = true
    console.log(`테스트 테스트 테스트 - Thick Mode OK - thin: ${oracledb.thin}, ClientVersion: ${oracledb.oracleClientVersionString}`)
}

export function getDb(
    { name = 'MAIN', isTransaction = false, isUserLess = false }: DbInfo =
    { name: 'MAIN', isTransaction: false, isUserLess: false },
): Db {
    console.log(`테스트 테스트 테스트 - db-new.ts - ${name}, ${isTransaction}, ${isUserLess}`)
    return {
        async run<R>(callback: (client: DbClient, userInfo?: Session) => Promise<R>): Promise<R> {
            // 사용자 정보 가져오기 (next-auth's Session 객체)
            const userInfo = !isUserLess ? (await auth()) ?? undefined : undefined
            if (!isUserLess && !userInfo) {
                throw new Error('해당 쿼리는 사용자 정보를 요구하지만 누락되었습니다.')
            }

            // 접속 정보 (DbConfig) 가져오기
            const raw = process.env[`DB_CONNECTION__${name}`]
            if (!raw) throw new Error(`환경변수 DB_CONNECTION__${name} 이 설정되지 않았습니다`)

            let config: DbConfig
            try {
                config = JSON.parse(raw) as DbConfig
            } catch {
                throw new Error(`DB_CONNECTION__${name} JSON 파싱 실패`)
            }

            const poolStore = getPoolStore()

            // provider 분기
            switch (config.providerName) {
                case 'oracle': {
                    // Oracle Thick 모드 초기화 (프로세스 1회)
                    ensureOracleThick()
                    // if (!isOracleThickInitialized) {
                    //     const libDir = path.resolve(process.cwd(), 'vendor/instantclient/instantclient_21_20')
                    //     oracledb.initOracleClient({ libDir })
                    //     isOracleThickInitialized = true
                    //     console.log(`Thick Mode OK - ClientVersion: ${oracledb.oracleClientVersionString}, thin: ${oracledb.thin}`)
                    // }

                    // 풀 확보 (없으면 생성, 있으면 재사용)
                    let pool = poolStore.get(name) as oracledb.Pool | undefined
                    if (!pool) {
                        pool = await oracledb.createPool({
                            user: config.user,
                            password: config.password,
                            connectString: config.connectString,
                            poolMin: config.poolMin ?? 10,
                            poolMax: config.poolMax ?? 100,
                            poolIncrement: config.poolIncrement ?? 1,
                            poolTimeout: config.poolTimeout ?? 60,
                            queueTimeout: config.queueTimeout ?? 3000,
                            poolAlias: name,
                        })
                        console.log(`테스트 테스트 테스트 - oracledb pool created - name: ${name}, poolMin: ${config.poolMin}, ${config.poolMax}, config.poolIncrement: ${config.poolIncrement}`)
                        poolStore.set(name, pool)
                    }

                    // Connection 가져오기
                    const conn = await pool.getConnection()

                    // DbClient — Oracle execute
                    const client: DbClient = {
                        async execute<T = Record<string, unknown>>(sql: string, binds: BindParams = {}): Promise<DbResult<T>> {
                            const result = await conn.execute<T>(
                                sql, binds as oracledb.BindParameters,
                                { autoCommit: !isTransaction, outFormat: oracledb.OUT_FORMAT_OBJECT },
                            )
                            return {
                                columns: (result.metaData ?? []).map((meta) => {
                                    const typeName = meta.dbTypeName ?? ''
                                    const columnType =
                                        typeName === 'NUMBER' ? 'number'
                                        : typeName === 'DATE' || typeName.startsWith('TIMESTAMP') ? 'date'
                                        : 'string'
                                    return { name: meta.name, type: columnType }
                                }),
                                rows: (result.rows ?? []) as T[],
                                affectedCount: result.rowsAffected ?? 0,
                            }
                        },
                    }

                    // Oracle Run
                    try {
                        if (!isTransaction) return await callback(client, userInfo)
                        try {
                            const result = await callback(client, userInfo)
                            await conn.commit()
                            return result
                        } catch (err) {
                            try { await conn.rollback() } catch { console.error(`Transaction Rollback 실패 (${name})`) }
                            throw err
                        }
                    } finally {
                        try { await conn.close() } catch { console.error(`Connection Release 실패 (${name})`) }
                    }
                }
                case 'postgres': {
                    // 풀 확보 (없으면 생성, 있으면 재사용)
                    let pool = poolStore.get(name) as PgPool | undefined
                    if (!pool) {
                        pool = new PgPool({
                            host: config.host,
                            port: config.port,
                            database: config.database,
                            user: config.user,
                            password: config.password,
                            min: config.min ?? 10,
                            max: config.max ?? 100,
                            idleTimeoutMillis: config.idleTimeoutMillis ?? 60_000,
                            connectionTimeoutMillis: config.connectionTimeoutMillis ?? 3_000,
                        })
                        poolStore.set(name, pool)
                    }

                    const conn: PgClient = await pool.connect()

                    // DbClient — pg execute
                    const client: DbClient = {
                        async execute<T = Record<string, unknown>>(sql: string, binds: BindParams = []): Promise<DbResult<T>> {
                            const r = await conn.query<T extends Record<string, unknown> ? T : never>(
                                sql, Array.isArray(binds) ? binds : Object.values(binds),
                            )
                            return {
                                columns: r.fields.map((f) => {
                                    const oid = f.dataTypeID
                                    const type: ColumnType =
                                        oid === 16 ? 'bool'
                                        : [20, 21, 23, 700, 701, 1700].includes(oid) ? 'number'
                                        : [1082, 1083, 1114, 1184, 1266].includes(oid) ? 'date'
                                        : 'string'
                                    return { name: f.name, type }
                                }),
                                rows: r.rows as T[],
                                affectedCount: r.rowCount ?? 0,
                            }
                        },
                    }

                    // Pg Run
                    try {
                        if (!isTransaction) return await callback(client, userInfo)
                        await conn.query('BEGIN')
                        try {
                            const result = await callback(client, userInfo)
                            await conn.query('COMMIT')
                            return result
                        } catch (err) {
                            try { await conn.query('ROLLBACK') } catch { console.error(`Transaction Rollback 실패 (${name})`) }
                            throw err
                        }
                    } finally {
                        try { conn.release() } catch { console.error(`Connection Release 실패 (${name})`) }
                    }
                }
                default: {
                    // providerName 가 두 가지 외 값이면 컴파일러가 never 로 좁힌다.
                    const _exhaustive: never = config
                    throw new Error(`지원하지 않는 provider: ${(_exhaustive as DbConfig).providerName}`)
                }
            }
        },
    }
}
