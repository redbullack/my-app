/**
 * @module lib/db/db-pg
 * @description PostgreSQL 전용 run 구현. db-new2.ts의 getDb()에서 분기되어 호출된다.
 */

import { Pool as PgPool, type PoolClient as PgClient } from 'pg'
import type { Session } from 'next-auth'
import type { DbClient, DbResult, BindParams, ColumnType, AppInfo } from './db-new2'

export type PgConfig = {
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

const globalDbCache = globalThis as typeof globalThis & {
    __myapp_pg_pool__?: Map<string, PgPool>
}

export async function runPg<R>(
    name: string,
    config: PgConfig,
    isTransaction: boolean,
    callback: (client: DbClient, userInfo?: Session, appInfo?: AppInfo) => Promise<R>,
    userInfo: Session | undefined,
    appInfo: AppInfo,
): Promise<R> {
    // 풀 확보
    const poolStore = globalDbCache.__myapp_pg_pool__ ??= new Map<string, PgPool>()

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

    try {
        if (!isTransaction) return await callback(client, userInfo, appInfo)
        await conn.query('BEGIN')
        try {
            const result = await callback(client, userInfo, appInfo)
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
