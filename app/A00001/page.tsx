'use client'

import Link from 'next/link'
import { useAppInfo } from '@/lib/hooks/useAppInfo'
import { Button, Panel, Badge } from '@/components/control'
import { useCallback } from 'react'
import { myServerAction } from './_actions/main'

export default function A00001Page() {
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

                    {/* prefetch 체험용: 아래 Link 가 화면에 보이는 순간 Next.js 가 자동으로 /A00002 에 대한
                        prefetch 요청을 쏜다. 클릭하지 않아도 proxy.ts 의 로그에 next-router-prefetch: 1 로 찍히는
                        요청이 들어오는 걸 확인할 수 있다. (prefetch={false} 로 끄면 hover/표시 시 요청이 사라진다) */}
                    <div className="flex flex-col gap-2 border-t border-[var(--color-border)] pt-4">
                        <span className="text-sm text-text-secondary">prefetch 체험</span>
                        <Link href="/A00002" className="text-accent underline">
                            /A00002 로 이동 (자동 prefetch O)
                        </Link>
                        <Link href="/A00002/JP" prefetch={false} className="text-accent underline">
                            /A00002/JP 로 이동 (prefetch X)
                        </Link>
                    </div>
                </div>
            </Panel>
        </div>
    )
}
