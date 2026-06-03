/**
 * @module lib/db/db-oracle
 * @description Oracle 전용 run 구현. db-new2.ts의 getDb()에서 분기되어 호출된다.
 */

import path from 'node:path'
import oracledb from 'oracledb'
import type { Session } from 'next-auth'
import type { DbClient, DbResult, BindParams, ColumnType, AppInfo } from './db-new2'
// import { insertLogQuery, isLogSkip } from './logger-new'

export type OracleConfig = {
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

const globalDbCache = globalThis as typeof globalThis & {
    __myapp_oracle_thick_initialized__?: boolean
    __myapp_oracle_pool___?: Map<string, oracledb.Pool>
}

export async function runOracle<R>(
    name: string,
    config: OracleConfig,
    isTransaction: boolean,
    callback: (client: DbClient, userInfo?: Session, appInfo?: AppInfo) => Promise<R>,
    userInfo: Session | undefined,
    appInfo: AppInfo,
): Promise<R> {
    // Oracle Thick 모드 초기화 (프로세스 1회)
    if (!(globalDbCache.__myapp_oracle_thick_initialized__ ??= false)) {
        const thickStartTime = Date.now();
        const libDir = path.resolve(process.cwd(), 'vendor/instantclient/instantclient_21_20')
        oracledb.initOracleClient({ libDir })
        globalDbCache.__myapp_oracle_thick_initialized__ = true
        console.log(`getDb - Thick Mode OK (${Date.now() - thickStartTime}) - ClientVersion: ${oracledb.oracleClientVersionString}, thin: ${oracledb.thin}`)
    }

    // 풀 확보 (없으면 생성, 있으면 재사용)
    const poolStore = globalDbCache.__myapp_oracle_pool___ ??= new Map<string, oracledb.Pool>()

    let pool = poolStore.get(name) as oracledb.Pool | undefined
    if (!pool) {
        const poolStartTime = Date.now()
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
        console.log(`getDb - oracledb pool created (${Date.now() - poolStartTime}) - name: ${name}, poolMin: ${config.poolMin}, ${config.poolMax}, config.poolIncrement: ${config.poolIncrement}`)
        poolStore.set(name, pool)
    }

    // Connection 가져오기
    const connStartTime = Date.now()
    const conn = await pool.getConnection()
    console.log(`getDb - pool.getConnection (${Date.now() - connStartTime})`)

    // DbClient — Oracle execute
    const client: DbClient = {
        async execute<T = Record<string, unknown>>(sql: string, binds: BindParams = {}): Promise<DbResult<T>> {
            const startedAt = new Date()
            try {
                const result = await conn.execute<T>(
                    sql, binds as oracledb.BindParameters,
                    { autoCommit: !isTransaction, outFormat: oracledb.OUT_FORMAT_OBJECT },
                )
                const dbResult: DbResult<T> = {
                    columns: (result.metaData ?? []).map((meta) => {
                        const typeName = meta.dbTypeName ?? ''
                        const type: ColumnType =
                            typeName === 'NUMBER' ? 'number'
                            : typeName === 'DATE' || typeName.startsWith('TIMESTAMP') ? 'date'
                            : 'string'
                        return { name: meta.name, type }
                    }),
                    rows: (result.rows ?? []) as T[],
                    affectedCount: result.rows?.length ?? result.rowsAffected ?? 0,
                }
                // if (!isLogSkip()) {
                //     void insertLogQuery({
                //         db: name, provider: 'oracle', op: 'execute',
                //         sql, binds: JSON.stringify(binds),
                //         startedAt, endedAt: new Date(),
                //         rowCount: dbResult.affectedCount,
                //         userId: userInfo?.user.id,
                //         userName: userInfo?.user.name,
                //         role: userInfo?.user.role,
                //         empno: userInfo?.user.empno.toString(),
                //     })
                // }
                return dbResult
            } catch (err) {
                // if (!isLogSkip()) {
                //     void insertLogQuery({
                //         db: name, provider: 'oracle', op: 'execute',
                //         sql, binds: JSON.stringify(binds),
                //         startedAt, endedAt: new Date(),
                //         errorDesc: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
                //         userId: userInfo?.user.id,
                //         userName: userInfo?.user.name,
                //         role: userInfo?.user.role,
                //         empno: userInfo?.user.empno.toString(),
                //     })
                // }
                throw err
            }
        },
    }

    try {
        if (!isTransaction) return await callback(client, userInfo, appInfo)
        try {
            const result = await callback(client, userInfo, appInfo)
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
