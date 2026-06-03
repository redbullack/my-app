/**
 * @module lib/db/db-new2
 * @description
 *
 * 호출:
 * const db = getDb({ name: 'MAIN' })
 * const r  = await db.run(async (agent) => agent.execute('SELECT * FROM emp WHERE empno=:n', { n: 7369 }))
 */

import type { Session } from 'next-auth'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth/auth' // auth.ts
import { OracleConfig, runOracle } from './db-oracle'
import { PgConfig, runPg } from './db-pg'

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
    run<R>(callback: (dbClient: DbClient, userInfo?: Session, appInfo?: AppInfo) => Promise<R>): Promise<R>
}
export type DbInfo = {
    name?: string
    isTransaction?: boolean
    isUserLess?: boolean
}

export type DbConfig = OracleConfig | PgConfig

export type AppInfo = { appId?: string; deptSite?: string }


export function getDb(
    { name = 'MAIN', isTransaction = false, isUserLess = false }: DbInfo =
    { name: 'MAIN', isTransaction: false, isUserLess: false },
): Db {
    console.log(`getDb - name: ${name}, isTransaction: ${isTransaction}, isUserLess: ${isUserLess}`)
    return {
        async run<R>(callback: (client: DbClient, userInfo?: Session, appInfo?: AppInfo) => Promise<R>): Promise<R> {
            // 사용자 정보 가져오기 (next-auth's Session 객체)
            const userInfo = !isUserLess ? (await auth()) ?? undefined : undefined
            if (!isUserLess && !userInfo) {
                throw new Error('해당 쿼리는 사용자 정보를 요구하지만 누락되었습니다.')
            }

            // 화면 컨텍스트 주입 (proxy.ts가 심은 request 헤더 기반)
            const header = await headers()
            const appInfo: AppInfo = {
                appId: header.get('x-app-id') ?? undefined,
                deptSite: header.get('x-dept-site') ?? undefined
            }
            console.log(`getDb - appInfo: ${appInfo.appId}, ${appInfo.deptSite}`)

            // 접속 정보 (DbConfig) 가져오기
            const raw = process.env[`DB_CONNECTION__${name}`]
            if (!raw) throw new Error(`환경변수 DB_CONNECTION__${name} 이 설정되지 않았습니다`)
            let config: DbConfig
            try {
                config = JSON.parse(raw) as DbConfig
            } catch {
                throw new Error(`DB_CONNECTION__${name} JSON 파싱 실패`)
            }

            // provider 분기
            switch (config.providerName) {
                case 'oracle':   return runOracle(name, config, isTransaction, callback, userInfo, appInfo)
                case 'postgres': return runPg(name, config, isTransaction, callback, userInfo, appInfo)
                default: {
                    const _exhaustive: never = config
                    throw new Error(`지원하지 않는 provider: ${(_exhaustive as DbConfig).providerName}`)
                }
            }
        },
    }
}
