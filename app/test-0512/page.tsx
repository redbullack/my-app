/**
 * @route /test-0512
 * @pattern Cascade Select + Function dataSource (Suspense)
 * @description
 * SCOTT.EMP 조회 화면.
 * - JOB (필수) → EMPNO / ENAME 으로 cascade.
 * - 모든 dataSource(Input/Grid)는 함수 형태로 전달.
 * - 조회 버튼 클릭 시 현재 조건을 bind 하여 useState 에 보관 → Grid 가 Suspense 로 fetch.
 * - Grid columns 는 QueryResult.columns 메타로 자동 추론.
 */
'use client'

import { useCallback, useMemo, useState } from 'react'
import { Button, Grid, Input, Panel } from '@/components/control'
import RouteInfo from '@/components/shared/RouteInfo'
import { toast } from '@/components/control/Toast'
import type { QueryResult } from '@/lib/db'
import {
  fetchEmpList,
  fetchEmpnoOptions,
  fetchEnameOptions,
  fetchJobOptions,
  type EmpRow,
  type EmpSearchCond,
} from './_actions/main'
import { useAction } from '@/lib/utils/client'

export default function Test0512Page() {
  const [cond, setCond] = useState<EmpSearchCond>({ job: [], empno: [], ename: [] })
  const [gridDataSource, setGridDataSource] = useState<QueryResult<EmpRow> | (() => ReturnType<typeof fetchEmpList>)>({ columns: [], rows: [] })
  // const [gridDataSource, setGridDataSource] = useState<QueryResult<EmpRow> | (() => Promise<ActionResponse<QueryResult<EmpRow>>>)>({ columns: [], rows: [] })

  const jobDataSource = useCallback(() => fetchJobOptions(), [])
  const empnoDataSource = useMemo(() => fetchEmpnoOptions.bind(null, cond.job), [cond.job])
  const enameDataSource = useMemo(() => fetchEnameOptions.bind(null, cond.job), [cond.job])

  const handleSelectChange = useCallback((next: string[], id?: string) => {
    setCond(prev => {
      switch (id) {
        case 'job':   return { job: next, empno: [], ename: [] }
        case 'empno': return { ...prev, empno: next }
        case 'ename': return { ...prev, ename: next }
        default: return prev
      }
    })
  }, [])

  const handleSearch = useCallback(() => {
    if (cond.job.length === 0) {
      toast('JOB은 필수 선택 항목입니다.', { variant: 'warning' })
      return
    }
    setGridDataSource(() => fetchEmpList.bind(null, cond))
  }, [cond])

  const {executeAction} = useAction<string>()
  const hookTest = useCallback(async () => {
    const result = await executeAction(() => fetchEmpList(cond))
    alert(`result: ${result?.rows[0].ENAME}, ${result?.rows[1].ENAME}`)
  }, [cond, executeAction])

  return (
    <main className="min-h-screen bg-bg-primary px-4 py-6">
      <div className="mx-auto max-w-[1200px]">
        <h1 className="mb-6 text-2xl font-bold text-text-primary">
          test-0512 — Cascade Select 조회 (JOB → EMPNO / ENAME)
        </h1>

        <Panel variant="outlined">
          <div className="grid grid-cols-1 gap-3 p-3 border-b border-border md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
            <Input
              id="job" type="select" label="JOB *"
              value={cond.job} onChange={handleSelectChange}
              dataSource={jobDataSource}
              helperText="필수 선택 (cascade 시작점)"
            />
            <Input
              id="empno" type="select" label="EMPNO"
              value={cond.empno} onChange={handleSelectChange}
              dataSource={empnoDataSource}
              disabled={cond.job.length === 0}
              helperText="JOB에 cascade"
            />
            <Input
              id="ename" type="select" label="ENAME"
              value={cond.ename} onChange={handleSelectChange}
              dataSource={enameDataSource}
              disabled={cond.job.length === 0}
              helperText="JOB에 cascade"
            />
            <Button variant="primary" size="md" onClick={handleSearch}>
              조회
            </Button>
            <Button variant="primary" size="md" onClick={hookTest}>
              hookTest
            </Button>
          </div>

          <Grid
            dataSource={gridDataSource}
            height="500px"
            rowHeight={34}
            rowHeaders={['rowNum']}
            columnResizable
          />
        </Panel>

        <div className="mt-6">
          <RouteInfo
            pattern="Cascade Select + Function dataSource"
            syntax="app/test-0512/page.tsx"
            description="JOB 선택을 root로 EMPNO/ENAME 옵션을 cascade하고, 조회 버튼 클릭 시 bind된 Server Action을 Grid의 dataSource로 주입합니다. Grid columns는 QueryResult 메타에서 자동 추론."
            docsUrl="https://react.dev/reference/react/Suspense"
          />
        </div>
      </div>
    </main>
  )
}
