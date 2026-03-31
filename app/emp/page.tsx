/**
 * @route /emp
 * @pattern Server Action + Client Component (data fetching via Server Action)
 * @description
 * scott.emp 테이블 조회 페이지.
 * MultiSelect로 ENAME 필터를 선택하고 조회 버튼을 누르면
 * Server Action(fetchEmpByNames)을 직접 호출하여 결과를 <pre>로 출력한다.
 * Route Handler(/api/emp)를 거치지 않고 서버에서 DB를 직접 조회하는 패턴이다.
 * 선택 없이 조회 시 전체 데이터를 반환한다.
 */
'use client'

import { useState } from 'react'
import { Button, MultiSelect } from '@/components/control'
import RouteInfo from '@/components/shared/RouteInfo'
import { fetchEmpByNames } from '@/actions/emp'
import type { Emp } from '@/types/emp'

const EMP_NAMES = [
  'SMITH', 'ALLEN', 'WARD', 'JONES', 'MARTIN',
  'BLAKE', 'CLARK', 'SCOTT', 'KING', 'TURNER',
  'ADAMS', 'JAMES', 'FORD', 'MILLER',
]

export default function EmpPage() {
  const [selectedNames, setSelectedNames] = useState<string[]>([])
  const [result, setResult] = useState<Emp[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSearch() {
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      // ── [Server Action] fetchEmpByNames 직접 호출 ──────────────────────────
      // Route Handler(/api/emp)를 거치지 않고 Server Action을 통해 DB를 직접 조회한다.
      // 네트워크 왕복(fetch → Route Handler → DB) 없이 서버 내부에서 바로 실행된다.
      const data = await fetchEmpByNames(selectedNames)
      setResult(data)

      // ── [Route Handler] fetch 방식 (주석 처리) ────────────────────────────
      // const params = new URLSearchParams()
      // selectedNames.forEach(name => params.append('enames', name))
      //
      // const url = `/api/emp${selectedNames.length > 0 ? `?${params.toString()}` : ''}`
      // const res = await fetch(url)
      //
      // if (!res.ok) {
      //   const body = await res.json() as { error?: string }
      //   throw new Error(body.error ?? `HTTP ${res.status}`)
      // }
      //
      // const data = await res.json() as Emp[]
      // setResult(data)
      // ─────────────────────────────────────────────────────────────────────

      // ── [Route Handler · POST] fetch 방식 (주석 처리) ────────────────────
      // 동적 세그먼트 Route Handler(/api/emp/[action])를 사용하여 POST로 조회한다.
      // Body에 enames 배열을 JSON으로 전달한다.
      //
      // const res = await fetch('/api/emp/search', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ enames: selectedNames }),
      // })
      //
      // if (!res.ok) {
      //   const body = await res.json() as { error?: string }
      //   throw new Error(body.error ?? `HTTP ${res.status}`)
      // }
      //
      // const data = await res.json() as Emp[]
      // setResult(data)
      // ─────────────────────────────────────────────────────────────────────
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg-primary)] px-4 py-10">
      <div className="mx-auto max-w-5xl flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">EMP 테이블 조회</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            scott.emp 테이블에서 사원 정보를 조회합니다.
          </p>
        </div>

        {/* MultiSelect 필터 */}
        <MultiSelect
          label="조회할 사원 선택 (미선택 시 전체 조회)"
          options={EMP_NAMES}
          value={selectedNames}
          onChange={setSelectedNames}
        />

        {/* 조회 버튼 */}
        <div>
          <Button
            variant="primary"
            size="md"
            isLoading={isLoading}
            onClick={handleSearch}
          >
            {isLoading ? '조회 중...' : '조회'}
          </Button>
        </div>

        {/* 결과 영역 */}
        {error && (
          <div className="rounded-lg border border-[var(--color-border)] bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
            오류: {error}
          </div>
        )}

        {result !== null && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-[var(--color-text-secondary)]">
              총 <strong>{result.length}</strong>건 조회됨
            </p>
            <pre className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 text-xs text-[var(--color-text-primary)] leading-relaxed">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}

        <RouteInfo
          pattern="Server Action + Client Component"
          syntax="actions/emp.ts + app/emp/page.tsx"
          description="Client Component에서 Server Action(fetchEmpByNames)을 직접 호출하여 Oracle DB를 조회하는 패턴입니다. Route Handler를 거치지 않아 네트워크 왕복이 줄어듭니다."
          docsUrl="https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations"
        />
      </div>
    </main>
  )
}
