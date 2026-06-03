'use client'

import { useAppInfo } from '@/lib/hooks/useAppInfo'
import { Button, Panel, Badge } from '@/components/control'
import { useCallback } from 'react'
import { myServerAction } from './_actions/main'

export default function A00002Page() {
    const appInfo = useAppInfo()

    const handleMyServerAction = useCallback(async () => {
        const result = await myServerAction()
        alert(`COL: ${result.rows[0].COL}, USER_ID: ${result.rows[0].USER_ID}`)
    }, [])

    return (
        <div className="mx-auto max-w-xl p-8">
            <Panel variant="elevated">
                <div className="flex flex-col gap-4">
                    <h1 className="text-xl font-semibold text-text-primary">화면 {appInfo.appId}</h1>
                    <div className="flex items-center gap-2 text-text-secondary">
                        <span>현재 deptSite:</span>
                        <Badge variant="info">{appInfo.deptSite}</Badge>
                    </div>
                    <Button variant="primary" onClick={handleMyServerAction}>
                        확인
                    </Button>
                </div>
            </Panel>
        </div>
    )
}
