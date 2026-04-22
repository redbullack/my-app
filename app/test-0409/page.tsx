/**
 * @route /test-0409
 * @pattern Server Action + Function-based dataSource (Suspense) + Tab Master-Detail
 * @description
 * SCOTT.EMP 조인 결과를 Grid로 조회하는 학습용 페이지.
 * - Tab 1 (조회): SearchPanel + Grid 조회, 더블클릭/체크 선택으로 Tab 2에 행 전달
 * - Tab 2 (편집): ENAME, SAL, COMM 인라인 편집 → 변경사항 확인 모달 → DB UPDATE
 * - useSearchParams로 탭 인덱스를 URL 쿼리(?tab=)에 반영
 */
'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Input, SearchPanel, Grid, Panel, Button, Tab, TabSub, Modal } from '@/components/control'
import type { GridColumn, ModifiedRow } from '@/components/control/Grid'
import RouteInfo from '@/components/shared/RouteInfo'
import {
  fetchEmpList,
  fetchDnameOptions,
  fetchJobOptions,
  fetchEnameOptions,
  updateEmpRows,
  type EmpSearchCond,
  type EmpRow,
  type EmpUpdateRow,
  fetchEmpListTest,
} from './_actions/main'
import type { ActionResponse } from '@/lib/utils'
import { useAction } from '@/lib/utils/client'
import { toast } from '@/components/control/Toast'

/* ── EMP 테이블 컬럼만 추출 ── */

const EMP_KEYS = ['EMPNO', 'ENAME', 'JOB', 'MGR', 'HIREDATE', 'SAL', 'COMM', 'DEPTNO'] as const

type EmpOnly = Pick<EmpRow, (typeof EMP_KEYS)[number]>

function pickEmpColumns(row: Record<string, unknown>): EmpOnly {
  return Object.fromEntries(EMP_KEYS.map(k => [k, row[k] ?? null])) as unknown as EmpOnly
}

/* ── Grid 컬럼 정의 (Tab 1 — 조회용, editor 없음) ── */

const gridColumns: GridColumn[] = [
  { name: 'EMPNO', header: '사번', width: 80, align: 'center', sortable: true, filter: 'text' },
  { name: 'ENAME', header: '이름', width: 100, align: 'center', sortable: true, filter: 'text' },
  { name: 'JOB', header: '직무', width: 110, align: 'center', sortable: true, filter: 'select' },
  { name: 'MGR', header: '상사번호', width: 80, align: 'center' },
  { name: 'HIREDATE', header: '입사일', width: 120, align: 'center', sortable: true, filter: 'date' },
  { name: 'SAL', header: '급여', width: 100, align: 'right', sortable: true, filter: 'number' },
  { name: 'GRADE', header: '등급', width: 70, align: 'center' },
  { name: 'COMM', header: '커미션', width: 90, align: 'right' },
  { name: 'DEPTNO', header: '부서번호', width: 80, align: 'center' },
  { name: 'DNAME', header: '부서명', width: 110, align: 'center', sortable: true, filter: 'select' },
  { name: 'LOC', header: '지역', width: 100, align: 'center' },
]

/* ── Grid 컬럼 정의 (Tab 2 — 편집용) ── */

const detailGridColumns: GridColumn[] = [
  { name: 'EMPNO', header: '사번', width: 80, align: 'center' },
  { name: 'ENAME', header: '이름', width: 120, align: 'center', editor: 'text' },
  { name: 'JOB', header: '직무', width: 110, align: 'center' },
  { name: 'MGR', header: '상사번호', width: 80, align: 'center' },
  { name: 'HIREDATE', header: '입사일', width: 120, align: 'center' },
  { name: 'SAL', header: '급여', width: 100, align: 'right', editor: 'text' },
  { name: 'COMM', header: '커미션', width: 100, align: 'right', editor: 'text' },
  { name: 'DEPTNO', header: '부서번호', width: 80, align: 'center' },
]

interface CondValues {
  dname: string[]
  job: string[]
  ename: string[]
}

export default function Test0409Page() {
  const { execute } = useAction()
  const [isPending, startTransition] = useTransition()
  const searchParams = useSearchParams()
  const router = useRouter()
  const tabIndex = Number(searchParams.get('tab') ?? '0')

  // const setTab = useCallback((idx: number) => {
  //   const params = new URLSearchParams(searchParams.toString())
  //   params.set('tab', String(idx))
  //   router.replace(`?${params.toString()}`, { scroll: false })
  // }, [searchParams, router])
  const handleChangeIndex = (index: number) => {
    router.push(`?tab=${index}`, { scroll: false })
  }

  /* ── 검색 조건 상태 ── */
  const [condValues, setCondValues] = useState<CondValues>({ dname: [], job: [], ename: [] })

  /* ── Tab 1: Grid 데이터 ── */
  const [gridDataSource, setGridDataSource] = useState<
    EmpRow[] | (() => Promise<ActionResponse<EmpRow[]>>)
  >([])
  const [checkedRows, setCheckedRows] = useState<EmpRow[]>([])

  /* ── Tab 2: Detail Grid 데이터 ── */
  const [detailRows, setDetailRows] = useState<EmpOnly[]>([])
  const [modifiedRows, setModifiedRows] = useState<ModifiedRow[]>([])

  /* ── 모달 상태 ── */
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  /* ── Cascade DataSource — Input/Grid 가 envelope 를 직접 언래핑한다 ── */
  const dnameDataSource = useCallback(() => fetchDnameOptions(), [])
  const jobDataSource = useCallback(
    () => fetchJobOptions(condValues.dname),
    [condValues.dname],
  )
  const enameDataSource = useCallback(
    () => fetchEnameOptions(condValues.dname, condValues.job),
    [condValues.dname, condValues.job],
  )

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

  const handleSearchClick = useCallback(() => {
    const cond: EmpSearchCond = { ...condValues }

    // Grid 가 ActionResponse envelope 를 직접 언래핑한다.
    // 실패 시 unwrapEnvelope → handleGlobalError 로 자동 라우팅.

    // startTransition(async () => {
    //   // const rst = await fetchEmpListTest(cond)
    //   // setGridDataSource(rst)
    //   await fetchEmpListTest(cond).then(rst => {
    //     setGridDataSource(rst)
    //   }).catch(err => {
    //     alert(err)
    //   })
    // })

    // setGridDataSource(() => () => fetchEmpList(cond))

    setGridDataSource(() => fetchEmpList.bind(null, cond))

    // fetchEmpListTest(cond).then(res => {
    //   if (res) {
    //     setGridDataSource(res.rows)
    //   } else {
    //     throw new Error('에러 발생 ! ! ! ')
    //   }
    // })

    // execute(fetchEmpList.bind(null, cond), {
    //   onSuccess: (data) => {
    //     // throw Error(`이것은 수 동 ! 에 ! 러 !`)
    //     setGridDataSource(data)
    //   },
    //   // onError: (error) => {
    //   //   alert(error)
    //   //   // return 'handled'
    //   // },
    //   throwToBoundary: true,
    //   // silent: true,
    // })

    setCheckedRows([])
    setDetailRows([])
    setModifiedRows([])
    handleChangeIndex(0)
  }, [condValues])

  /* ── Tab 1 이벤트 ── */

  const handleCellDoubleClick = useCallback((ev: { rowKey: number | string | null; columnName: string | null; value: unknown; rowData: Record<string, unknown> }) => {
    console.log('rowData:', ev.rowData)
  }, [])

  const handleCheckChange = useCallback((rows: Record<string, unknown>[]) => {
    setCheckedRows(rows as unknown as EmpRow[])
  }, [])

  const handleSelectEdit = useCallback(() => {
    if (checkedRows.length === 0) {
      toast('편집할 행을 체크하세요.', { variant: 'warning' })
      return
    }
    const empRows = checkedRows.map(r => pickEmpColumns(r as unknown as Record<string, unknown>))
    setDetailRows(empRows)
    setModifiedRows([])
    handleChangeIndex(1)
  }, [checkedRows, toast])

  /* ── Tab 2 이벤트 ── */

  const handleSaveClick = useCallback(() => {
    if (modifiedRows.length === 0) {
      toast('변경된 내용이 없습니다.', { variant: 'info' })
      return
    }
    setIsModalOpen(true)
  }, [modifiedRows, toast])

  /**
   * useAction.execute 가 envelope 를 자동 언래핑하고 실패 시 handleGlobalError 로 라우팅.
   * 개발자는 try/catch·에러 분기·로깅을 쓰지 않는다.
   */
  const handleConfirmSave = useCallback(() => {
    const updateRows: EmpUpdateRow[] = modifiedRows.map(m => {
      const rd = m.rowData as Record<string, unknown>
      return {
        EMPNO: String(rd.EMPNO ?? m.rowKey),
        ENAME: rd.ENAME != null ? String(rd.ENAME) : null,
        SAL: rd.SAL != null ? String(rd.SAL) : null,
        COMM: rd.COMM != null ? String(rd.COMM) : null,
      }
    })
    setIsSaving(true)
    void execute(() => updateEmpRows(updateRows), {
      onSuccess: ({ updated }) => {
        toast(`${updated}건 수정 완료`, { variant: 'success' })
        setDetailRows(prev => [...prev])
        setIsModalOpen(false)
      },
    }).finally(() => setIsSaving(false))
  }, [modifiedRows, execute])

  const COLUMN_LABELS: Record<string, string> = { ENAME: '이름', SAL: '급여', COMM: '커미션' }

  useEffect(() => {
    // execute(() => fetchEmpList({ dname: [], ename: [], job: [] }), {
    //   onError: (err) => {
    //     console.log('Custom handled error:', err)
    //     return 'handled'
    //   },
    // })

    // handleSearchClick()

    // execute(() => fetchEmpList({ dname: [], ename: [], job: [] }), {
    //   onSuccess: (data) => {
    //     setGridDataSource(data)
    //   },
    //   onError(error) {
    //     alert('Custom handled error: ' + error)
    //     return 'handled'
    //   },
    // })
  }, [])

  return (
    <main className="min-h-screen bg-bg-primary px-4 py-6">
      <div className="mx-auto max-w-[1400px]">
        <h1 className="mb-6 text-2xl font-bold text-text-primary">
          test-0409 — SCOTT.EMP 조회/편집 (Tab Master-Detail)
        </h1>

        <div className="flex gap-6 items-start">
          <SearchPanel label="Search Panel" onSearchClick={handleSearchClick}>
            <Input
              id="dname" type="select" label="DNAME"
              value={condValues.dname} onChange={handleSelectChange}
              dataSource={dnameDataSource} helperText="부서명 (cascade 시작점)"
            />
            <Input
              id="job" type="select" label="JOB"
              value={condValues.job} onChange={handleSelectChange}
              dataSource={jobDataSource} helperText="DNAME에 cascade"
            />
            <Input
              id="ename" type="select" label="ENAME"
              value={condValues.ename} onChange={handleSelectChange}
              dataSource={enameDataSource} helperText="DNAME + JOB에 cascade"
            />
          </SearchPanel>

          <div className="flex-1 min-w-0">
            <Tab activeIndex={tabIndex} onChangeIndex={handleChangeIndex}>
              {/* ── Tab 1: 조회 ── */}
              <TabSub label="조회">
                <Panel variant="outlined">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                    <Button variant="secondary" size="sm" onClick={handleSelectEdit}>
                      선택 편집
                    </Button>
                    <span className="text-xs text-text-muted">
                      체크: {checkedRows.length}건
                    </span>
                  </div>

                  <Grid
                    dataSource={gridDataSource}
                    columns={gridColumns}
                    height="600px"
                    rowHeight={36}
                    emptyMessage="좌측 조건을 선택하고 Search 버튼을 클릭하세요"
                    rowHeaders={['checkbox', 'rowNum']}
                    sortable
                    columnResizable
                    frozenColumnCount={2}
                    onCellDoubleClick={handleCellDoubleClick}
                    onCheckChange={handleCheckChange}
                  />
                </Panel>
              </TabSub>

              {/* ── Tab 2: 편집 ── */}
              <TabSub label="편집">
                <Panel variant="outlined">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                    <Button variant="primary" size="sm" onClick={handleSaveClick}>
                      변경 사항 저장
                    </Button>
                    <span className="text-xs text-text-muted">
                      {detailRows.length}건
                    </span>
                  </div>

                  <Grid
                    dataSource={detailRows}
                    columns={detailGridColumns}
                    height="600px"
                    rowHeight={36}
                    emptyMessage="조회 탭에서 행을 더블클릭하거나 선택 편집 버튼을 클릭하세요"
                    rowHeaders={['rowNum']}
                    columnResizable
                    editable
                    onModifiedRows={setModifiedRows}
                  />
                </Panel>
              </TabSub>
            </Tab>
          </div>
        </div>

        <div className="mt-6">
          <RouteInfo
            pattern="Function dataSource + Suspense + Tab Master-Detail"
            syntax="app/test-0409/page.tsx"
            description="Tab 1에서 조회/선택한 행을 Tab 2에서 편집하고 DB에 반영하는 마스터-디테일 패턴. useSearchParams로 탭 상태를 URL에 반영합니다."
            docsUrl="https://react.dev/reference/react/Suspense"
          />
        </div>
      </div>

      {/* ── 변경 확인 모달 ── */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="변경 사항 확인">
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">아래 내용을 수정하시겠습니까?</p>
          <div className="max-h-80 overflow-y-auto space-y-3">
            {modifiedRows.map(m => {
              const empno = String((m.rowData as Record<string, unknown>).EMPNO ?? m.rowKey)
              return (
                <div key={empno} className="rounded border border-border p-3">
                  <p className="text-sm font-semibold text-text-primary mb-2">사번: {empno}</p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-text-muted">
                        <th className="text-left py-1">컬럼</th>
                        <th className="text-left py-1">이전</th>
                        <th className="text-left py-1">이후</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(m.changes).map(([col, { before, after }]) => (
                        <tr key={col}>
                          <td className="py-1 text-text-primary">{COLUMN_LABELS[col] ?? col}</td>
                          <td className="py-1 text-text-muted line-through">{String(before ?? '(없음)')}</td>
                          <td className="py-1 text-accent font-medium">{String(after ?? '(없음)')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setIsModalOpen(false)}>
              취소
            </Button>
            <Button variant="primary" size="sm" onClick={handleConfirmSave} isLoading={isSaving}>
              확인
            </Button>
          </div>
        </div>
      </Modal>
    </main>
  )
}

export type { EmpRow }
