import { getDb } from "./db/db-new2";

type DeptSites = 'KR' | 'JP' | 'CN'

export async function getDeptSites(appId: string): Promise<DeptSites[]> {
    console.log(`proxy.ts - >>>>> getDeptSites() 시작 ! appId: ${appId} <<<<<`)
    const result = await getDb({ name: 'MAIN' }).run(async (client) => {
        return await client.execute<{
            APP_ID: string
            HAS_KR_FLAG: string
            HAS_JP_FLAG: string
            HAS_CN_FLAG: string
        }>(
            `SELECT DISTINCT APP_ID, HAS_KR_FLAG, HAS_JP_FLAG, HAS_CN_FLAG  
               FROM SCOTT.TEST_APP
               WHERE APP_ID = :APP_ID`,
            { APP_ID: appId }
        )
    })

    if (result.affectedCount === 0) {
        return []
    }

    const depts: DeptSites[] = []
    if (result.rows[0].HAS_KR_FLAG === 'Y') depts.push('KR')
    if (result.rows[0].HAS_JP_FLAG === 'Y') depts.push('JP')
    if (result.rows[0].HAS_CN_FLAG === 'Y') depts.push('CN')

    console.log(`proxy.ts - >>>>> getDeptSites() 끝 ! appId: ${appId}, depts: ${depts.join(',')} <<<<<`)
    return depts
}