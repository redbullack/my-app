/**
 * @route /test-0419
 * @pattern Server Action + Transaction 테스트
 * @description
 * `lib/db/factory.ts` 의 ALS 기반 `db.tx(async () => ...)` 동작 검증용 페이지.
 * - 조회 버튼: SCOTT.EMP 단순 조회
 * - Commit 테스트: 두 건 SAL +delta → 커밋 후 before/after 비교
 * - Rollback 테스트: 두 건 SAL +delta 후 고의 throw → 롤백되어 원복되는지 확인
 */
'use client'

import { useCallback, useState } from 'react'
import { Button, Grid, Panel, Input } from '@/components/control'
import type { GridColumn } from '@/components/control/Grid'
import RouteInfo from '@/components/shared/RouteInfo'
import type { ActionResponse } from '@/lib/utils'
import { useAction } from '@/lib/utils/client'
import type { QueryResult } from '@/lib/db'
import { toast } from '@/components/control/Toast'
import {
  fetchEmpSimple,
  runTxCommit,
  runTxTest,
  type EmpSimpleRow,
  type TxTestResult,
} from './_actions/main'

const columns: GridColumn[] = [
  { name: 'EMPNO', header: '사번', width: 80, align: 'center' },
  { name: 'ENAME', header: '이름', width: 120, align: 'center' },
  { name: 'JOB', header: '직무', width: 120, align: 'center' },
  { name: 'SAL', header: '급여', width: 100, align: 'right' },
  { name: 'DEPTNO', header: '부서번호', width: 80, align: 'center' },
]

export default function Test0419Page() {
  const { execute } = useAction()
  // const [rows, setRows] = useState<EmpSimpleRow[]>([])
  const [rows, setRows] = useState<
    QueryResult<EmpSimpleRow> | (() => Promise<ActionResponse<QueryResult<EmpSimpleRow>>>)
  >({ columns: [], rows: [] })
  const [empnoA, setEmpnoA] = useState('10000')
  const [empnoB, setEmpnoB] = useState('10001')
  const [delta, setDelta] = useState('1')
  const [txResult, setTxResult] = useState<TxTestResult | null>(null)

  // const reload = useCallback(() => {
  //   execute(fetchEmpSimple, {
  //     onSuccess: data => setRows(data),
  //   })
  // }, [execute])
  const reload = useCallback(() => {
    setRows(() => fetchEmpSimple.bind(null))
  }, [])

  const handleCommit = useCallback(() => {
    execute(
      runTxCommit.bind(null, { empnoA, empnoB, delta: Number(delta) || 0 }),
      {
        onSuccess: data => {
          setTxResult(data)
          toast('Commit 완료', { variant: 'success' })
          reload()
        },
      },
    )
  }, [execute, empnoA, empnoB, delta, reload])

  const handleTxTest = useCallback(() => {
    execute(
      runTxTest.bind(null),
      {
        onSuccess: (data) => {
          toast(`data: ${data}`, { variant: 'info' })
        },
        onError: (err) => {
          toast(`data: ${err.message} / ${err.devMessage} / ${err.cause}`, { variant: 'error' })
          return 'handled'
        }
      }
    )
  }, [execute])

  // const handleRollback = useCallback(() => {
  //   execute(
  //     runTxRollback.bind(null, { empnoA, empnoB, delta: Number(delta) || 0 }),
  //     {
  //       onSuccess: data => {
  //         setTxResult(data)
  //         toast('Rollback 확인 — 값이 원복되었는지 검증하세요', {
  //           variant: 'info',
  //         })
  //         reload()
  //       },
  //     },
  //   )
  // }, [execute, empnoA, empnoB, delta, reload])

  return (
    <main className="min-h-screen bg-bg-primary px-4 py-6">
      <div className="mx-auto max-w-[1200px]">
        <h1 className="mb-6 text-2xl font-bold text-text-primary">
          test-0419 — Oracle Transaction 테스트
        </h1>

        {txResult && (
          <Panel variant="outlined">
            <div className="p-3 text-sm text-text-primary">
              <p className="mb-2 font-semibold">
                Transaction Result — {txResult.committed ? 'COMMIT' : 'ROLLBACK'}
              </p>
              <table className="w-full">
                <thead>
                  <tr className="text-text-muted">
                    <th className="text-left py-1">EMPNO</th>
                    <th className="text-left py-1">Before SAL</th>
                    <th className="text-left py-1">After SAL</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-1">{empnoA}</td>
                    <td className="py-1">{txResult.beforeA ?? '(null)'}</td>
                    <td className="py-1">{txResult.afterA ?? '(null)'}</td>
                  </tr>
                  <tr>
                    <td className="py-1">{empnoB}</td>
                    <td className="py-1">{txResult.beforeB ?? '(null)'}</td>
                    <td className="py-1">{txResult.afterB ?? '(null)'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        <Panel variant="outlined">
          <div className="flex flex-wrap items-end gap-3 p-3 border-b border-border">
            <Input
              id="empnoA"
              type="text"
              label="EMPNO A"
              value={empnoA}
              onChange={e => setEmpnoA(e.target.value)}
            />
            <Input
              id="empnoB"
              type="text"
              label="EMPNO B"
              value={empnoB}
              onChange={e => setEmpnoB(e.target.value)}
            />
            <Input
              id="delta"
              type="text"
              label="SAL 증감치"
              value={delta}
              onChange={e => setDelta(e.target.value)}
            />
            <Button variant="secondary" size="sm" onClick={reload}>
              조회
            </Button>
            <Button variant="primary" size="sm" onClick={handleCommit}>
              Commit 테스트
            </Button>
            <Button variant="primary" size="sm" onClick={handleTxTest}>
              tx 테스트
            </Button>

          </div>

          <Grid
            dataSource={rows}
            columns={columns}
            height="500px"
            rowHeight={34}
            emptyMessage="조회 버튼을 클릭하세요"
            rowHeaders={['rowNum']}
            columnResizable
          />
        </Panel>

        <div className="mt-6">
          <RouteInfo
            pattern="Server Action + db.tx() (ALS 트랜잭션)"
            syntax="app/test-0419/page.tsx"
            description="db.tx() 콜백 내 여러 UPDATE 가 단일 커넥션 위에서 원자적으로 commit/rollback 되는지 검증합니다."
            docsUrl="https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations"
          />
        </div>
      </div>
    </main>
  )
}
