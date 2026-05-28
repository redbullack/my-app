import { getDb } from "./db/db-new2";

type DeptSites = 'KR' | 'JP' | 'CN'

const APP_REGISTRY: Record<string, DeptSites[]> = {
  A001: ['KR', 'JP', 'CN'],
  A002: ['KR', 'JP'],
}

export function getDeptSites(appId: string): DeptSites[] {
  return APP_REGISTRY[appId] ?? ['KR']
}

const cache: { data: Record<string, DeptSites[]>; expiresAt: number } = {
    data: {},
    expiresAt: 0,
}

export async function getDeptSitesCached(appId: string): Promise<DeptSites[]> {
    if (Date.now() > cache.expiresAt) {
        console.log(`SERVER: appRegistry.ts - 캐싱 하자...`)
        const result = await getDb({ name: 'MAIN', isUserLess: true }).run(async (agent) => {
            return await agent.execute<{
                APP_ID: string
                HAS_KR_FLAG: string
                HAS_JP_FLAG: string
                HAS_CN_FLAG: string
            }>(
                `SELECT 'A001' APP_ID, 'Y' HAS_KR_FLAG, 'Y' HAS_JP_FLAG, 'Y' HAS_CN_FLAG FROM DUAL UNION ALL 
                 SELECT 'A002' APP_ID, 'Y' HAS_KR_FLAG, 'Y' HAS_JP_FLAG, 'N' HAS_CN_FLAG FROM DUAL `,
            )
        })

        const data: Record<string, DeptSites[]> = {}
        for (const row of result.rows) {
            const depts: DeptSites[] = []
            if (row.HAS_KR_FLAG === 'Y') depts.push('KR')
            if (row.HAS_JP_FLAG === 'Y') depts.push('JP')
            if (row.HAS_CN_FLAG === 'Y') depts.push('CN')
            data[row.APP_ID] = depts
        }

        cache.data = data
        cache.expiresAt = Date.now() + 60_000
    } else {
        console.log(`SERVER: appRegistry.ts - 이미 캐싱된 상태...`)
    }

    return cache.data[appId] ?? []
}

