/**
 * @route /A002 · /A002/KR · /A002/JP
 * @pattern 평평한 화면 폴더 + proxy rewrite + useAppInfo
 * @description
 * 화면(appId)당 폴더 1개(app/A002) 원칙. deptSite는 별도 폴더 없이
 * URL 세그먼트로만 받는다. proxy.ts가 인가 검증 + rewrite를 처리하고,
 * 이 화면은 useAppInfo()로 appId/deptSite를 한 줄에 읽어 쓴다.
 */
'use client'

import { useAppInfo } from '@/lib/hooks/useAppInfo'
import { Button, Panel, Badge } from '@/components/control'

export default function A002Page() {
  const appInfo = useAppInfo()

  return (
    <div className="mx-auto max-w-xl p-8">
      <Panel variant="elevated">
        <div className="flex flex-col gap-4">
          <h1 className="text-xl font-semibold text-text-primary">화면 {appInfo.appId}</h1>
          <div className="flex items-center gap-2 text-text-secondary">
            <span>현재 deptSite:</span>
            <Badge variant="info">{appInfo.deptSite}</Badge>
          </div>
          <Button variant="primary" onClick={() => alert(`${appInfo.appId} / ${appInfo.deptSite}`)}>
            확인
          </Button>
        </div>
      </Panel>
    </div>
  )
}
