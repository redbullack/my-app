/**
 * @route /test-0409
 * @pattern Server Action + Function-based dataSource (Suspense)
 * @description
 * SCOTT.EMP 조인 결과를 Grid로 조회하는 학습용 페이지.
 * - SearchPanel에 DNAME → JOB → ENAME 의 cascade Select Input 3개 배치
 * - Input의 dataSource는 Server Action을 useCallback으로 래핑한 함수형으로 전달
 * - Grid의 dataSource도 함수형으로 전달하여, Grid 내부 <Suspense>의
 *   GridSkeleton fallback으로 로딩 상태가 자동 처리된다.
 */
'use client'

import { useCallback, useState } from 'react'
import { Input, SearchPanel, Grid, Panel } from '@/components/control'
import RouteInfo from '@/components/shared/RouteInfo'
import {
  fetchEmpList,
  fetchDnameOptions,
  fetchJobOptions,
  fetchEnameOptions,
  type EmpSearchCond,
  type EmpRow,
} from './_actions/main'

interface CondValues {
  dname: string[]
  job: string[]
  ename: string[]
}

export default function Test0409Page() {
  /* ── 검색 조건 상태 ── */
  const [condValues, setCondValues] = useState<CondValues>({ dname: [], job: [], ename: [] })

  /* ── Grid 데이터 상태 ── */
  const [gridDataSource, setGridDataSource] = useState<EmpRow[] | Promise<EmpRow[]>>([])

  /* ── Cascade DataSource (함수형) ── */
  const dnameDataSource = useCallback(
    () => fetchDnameOptions(),
    [],
  )
  const jobDataSource = useCallback(
    () => fetchJobOptions(condValues.dname),
    [condValues.dname],
  )
  const enameDataSource = useCallback(
    () => fetchEnameOptions(condValues.dname, condValues.job),
    [condValues.dname, condValues.job],
  )

  /* ── Select 변경 — 하위 의존성 초기화 ── */
  const handleSelectChange = useCallback((next: string[], id?: string) => {
    setCondValues(prev => {
      switch (id) {
        case 'dname': return { ...prev, dname: next, job: [], ename: [] }
        case 'job': return { ...prev, job: next, ename: [] }
        case 'ename': return { ...prev, ename: next }
        default: return prev
      }
    })
  }, [])

  const handleSearchClick = useCallback(async () => {
    const cond: EmpSearchCond = { ...condValues }
    setGridDataSource(fetchEmpList(cond))
  }, [condValues])

  const handleCellDoubleClick = useCallback((ev: { rowKey: number | string | null; columnName: string | null; value: unknown }) => {
    console.log('onCellDoubleClick', ev)
  }, [])

  return (
    <main className="min-h-screen bg-bg-primary px-4 py-6">
      <div className="mx-auto max-w-[1400px]">
        <h1 className="mb-6 text-2xl font-bold text-text-primary">
          test-0409 — SCOTT.EMP 조회 (Function dataSource + Suspense)
        </h1>

        <div className="flex gap-6 items-start">
          <SearchPanel label="Search Panel" onSearchClick={handleSearchClick}>
            <Input
              id="dname"
              type="select"
              label="DNAME"
              value={condValues.dname}
              onChange={handleSelectChange}
              dataSource={dnameDataSource}
              helperText="부서명 (cascade 시작점)"
            />
            <Input
              id="job"
              type="select"
              label="JOB"
              value={condValues.job}
              onChange={handleSelectChange}
              dataSource={jobDataSource}
              helperText="DNAME에 cascade"
            />
            <Input
              id="ename"
              type="select"
              label="ENAME"
              value={condValues.ename}
              onChange={handleSelectChange}
              dataSource={enameDataSource}
              helperText="DNAME + JOB에 cascade"
            />
          </SearchPanel>

          <div className="flex-1 min-w-0">
            <Panel variant="outlined">
              <Grid
                dataSource={gridDataSource}
                height="600px"
                emptyMessage="좌측 조건을 선택하고 Search 버튼을 클릭하세요"
                onCellDoubleClick={handleCellDoubleClick}
                rowHeaders={['checkbox', 'rowNum']}
              />
            </Panel>
          </div>
        </div>

        <div className="mt-6">
          <RouteInfo
            pattern="Function dataSource + Suspense"
            syntax="app/test-0409/page.tsx"
            description="Grid의 dataSource를 함수(Server Action)로 전달하면, Grid 내부 <Suspense>가 GridSkeleton을 fallback으로 표시합니다. ErrorBoundary 래핑이 없으므로 렌더 에러는 상위로 전파됩니다."
            docsUrl="https://react.dev/reference/react/Suspense"
          />
        </div>
      </div>
    </main>
  )
}

// EmpRow 타입은 _actions/main.ts에서 export하여 외부에서도 재사용할 수 있도록 한다.
export type { EmpRow }
