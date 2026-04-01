/**
 * @route /tabs/example-b
 * @pattern Static Route + searchParams-based Tabs
 * @description
 * URL의 ?tab= 쿼리 파라미터로 탭 상태를 관리한다.
 * Tab 컴포넌트의 controlled 모드(activeIndex + onChangeIndex)를 사용하여
 * 탭 전환 시 URL이 업데이트되고, 브라우저 뒤로가기/앞으로가기로 탭 전환이 가능하다.
 * 탭 1에서 작성한 메모가 탭 2의 미리보기에 실시간 반영된다.
 */
'use client'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Tab, TabSub, Panel, Badge } from '@/components/control'
import RouteInfo from '@/components/shared/RouteInfo'

interface Memo {
  id: number
  text: string
  createdAt: string
}

function ExampleBContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const tabIndex = Number(searchParams.get('tab') ?? '0')

  const [draft, setDraft] = useState('')
  const [memos, setMemos] = useState<Memo[]>([])
  const [nextId, setNextId] = useState(1)

  const handleChangeIndex = (index: number) => {
    router.push(`?tab=${index}`, { scroll: false })
  }

  const handleSave = () => {
    if (!draft.trim()) return
    setMemos((prev) => [
      { id: nextId, text: draft.trim(), createdAt: new Date().toLocaleTimeString('ko-KR') },
      ...prev,
    ])
    setNextId((n) => n + 1)
    setDraft('')
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Example B — searchParams 기반</h1>
        <p className="mt-2 text-text-secondary">
          URL의 <code className="rounded bg-bg-tertiary px-1.5 py-0.5 text-xs">?tab=</code> 파라미터로 탭을 제어합니다.
          브라우저 뒤로가기/앞으로가기로 탭 전환이 가능합니다.
        </p>
      </div>

      <Panel variant="outlined">
        <Tab activeIndex={tabIndex} onChangeIndex={handleChangeIndex}>
          {/* 메모 작성 탭 */}
          <TabSub label="메모 작성">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  새 메모
                </label>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="메모를 입력하세요..."
                  rows={4}
                  className="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none"
                />
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-xs text-text-muted">
                    {draft.length}자 입력됨
                  </span>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!draft.trim()}
                    className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    저장
                  </button>
                </div>
              </div>
            </div>
          </TabSub>

          {/* 메모 목록 탭 */}
          <TabSub label={`메모 목록 (${memos.length})`}>
            <div className="space-y-3">
              {memos.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-muted">
                  저장된 메모가 없습니다. 메모 작성 탭에서 메모를 추가해보세요.
                </p>
              ) : (
                memos.map((memo) => (
                  <div
                    key={memo.id}
                    className="rounded-lg border border-border bg-bg-secondary p-3"
                  >
                    <p className="text-sm text-text-primary whitespace-pre-wrap">
                      {memo.text}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant="info">#{memo.id}</Badge>
                      <span className="text-xs text-text-muted">{memo.createdAt}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabSub>

          {/* 실시간 미리보기 탭 */}
          <TabSub label="실시간 미리보기">
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-text-secondary">현재 작성 중인 메모</h3>
              <div className="rounded-lg border border-border bg-bg-secondary p-4 min-h-[120px]">
                {draft.trim() ? (
                  <p className="text-sm text-text-primary whitespace-pre-wrap">{draft}</p>
                ) : (
                  <p className="text-sm text-text-muted">
                    메모 작성 탭에서 텍스트를 입력하면 여기에 실시간으로 표시됩니다.
                  </p>
                )}
              </div>
            </div>
          </TabSub>
        </Tab>
      </Panel>

      <RouteInfo
        pattern="searchParams-based Tabs"
        syntax="app/tabs/example-b/page.tsx"
        description="URL 쿼리 파라미터(?tab=)로 탭 상태를 관리한다. Tab의 controlled 모드를 사용하여 외부에서 탭 인덱스를 제어한다."
        docsUrl="https://nextjs.org/docs/app/api-reference/functions/use-search-params"
      />
    </div>
  )
}

export default function ExampleBPage() {
  return (
    <Suspense fallback={<div className="p-8 text-text-muted">로딩 중...</div>}>
      <ExampleBContent />
    </Suspense>
  )
}
