'use server'
import { getDb } from "@/lib/db/db-new2";

export async function myServerAction() {
    return getDb().run(async (client, userInfo, appInfo) => {
        console.log(`SERVER: main.ts - ${appInfo?.appId}, ${appInfo?.deptSite}`)
        return await client.execute<{COL: string, USER_ID: string}>(
            `SELECT 1 COL, :userId USER_ID FROM DUAL`, {userId: userInfo?.user.id}
        )
    })
}