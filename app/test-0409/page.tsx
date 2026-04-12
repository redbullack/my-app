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

import { useCallback, useState, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Input, SearchPanel, Grid, Panel, Button, Tab, TabSub, Modal } from '@/components/control'
import type { GridColumn } from '@/components/control/Grid'
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
} from './_actions/main'

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

/* ── 변경 추적 타입 ── */

interface CellChange {
  before: unknown
  after: unknown
}

// rowKey(EMPNO) → columnName → { before, after }
type ChangesMap = Record<string, Record<string, CellChange>>

interface CondValues {
  dname: string[]
  job: string[]
  ename: string[]
}

export default function Test0409Page() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tabIndex = Number(searchParams.get('tab') ?? '0')

  const setTab = useCallback((idx: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', String(idx))
    router.replace(`?${params.toString()}`, { scroll: false })
  }, [searchParams, router])

  /* ── 검색 조건 상태 ── */
  const [condValues, setCondValues] = useState<CondValues>({ dname: [], job: [], ename: [] })

  /* ── Tab 1: Grid 데이터 ── */
  const [gridDataSource, setGridDataSource] = useState<EmpRow[] | Promise<EmpRow[]>>([])
  const [checkedRows, setCheckedRows] = useState<EmpRow[]>([])

  /* ── Tab 2: Detail Grid 데이터 ── */
  const [detailRows, setDetailRows] = useState<EmpOnly[]>([])
  const originalRowsRef = useRef<EmpOnly[]>([])
  const [changesMap, setChangesMap] = useState<ChangesMap>({})

  /* ── 모달 상태 ── */
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  /* ── Cascade DataSource ── */
  const dnameDataSource = useCallback(() => fetchDnameOptions(), [])
  const jobDataSource = useCallback(() => fetchJobOptions(condValues.dname), [condValues.dname])
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

  const handleSearchClick = useCallback(async () => {
    const cond: EmpSearchCond = { ...condValues }
    setGridDataSource(fetchEmpList(cond))
    setCheckedRows([])
    setDetailRows([])
    setChangesMap({})
    originalRowsRef.current = []
    setTab(0)
  }, [condValues])

  /* ── Tab 2로 행 추가 (중복 EMPNO 제거) ── */
  const addToDetail = useCallback((rows: EmpOnly[]) => {
    setDetailRows(prev => {
      const existingKeys = new Set(prev.map(r => r.EMPNO))
      const newRows = rows.filter(r => !existingKeys.has(r.EMPNO))
      const merged = [...prev, ...newRows]
      originalRowsRef.current = merged.map(r => ({ ...r }))
      return merged
    })
    setChangesMap({})
    setTab(1)
  }, [setTab])

  /* ── Tab 1 이벤트 ── */

  const handleCellDoubleClick = useCallback((ev: { rowKey: number | string | null; columnName: string | null; value: unknown; rowData: Record<string, unknown> }) => {
    console.log('rowData:', ev.rowData)
  }, [])

  const handleCheckChange = useCallback((rows: Record<string, unknown>[]) => {
    setCheckedRows(rows as unknown as EmpRow[])
  }, [])

  const handleSelectEdit = useCallback(() => {
    if (checkedRows.length === 0) {
      alert('편집할 행을 체크하세요.')
      return
    }
    const empRows = checkedRows.map(r => pickEmpColumns(r as unknown as Record<string, unknown>))
    addToDetail(empRows)
  }, [checkedRows, addToDetail])

  /* ── Tab 2 이벤트 ── */

  const handleDetailAfterChange = useCallback((ev: { changes: Array<{ rowKey: number | string; columnName: string; value: unknown }> }) => {
    setChangesMap(prev => {
      const next = { ...prev }
      for (const ch of ev.changes) {
        const rk = String(ch.rowKey)
        if (!next[rk]) next[rk] = {}
        // before 값은 최초 변경 시에만 기록
        if (!next[rk][ch.columnName]) {
          const orig = originalRowsRef.current[Number(rk)]
          next[rk][ch.columnName] = {
            before: orig ? (orig as Record<string, unknown>)[ch.columnName] : null,
            after: ch.value,
          }
        } else {
          next[rk][ch.columnName] = { ...next[rk][ch.columnName], after: ch.value }
        }
      }
      return next
    })
    // detailRows도 동기화
    setDetailRows(prev => {
      const updated = [...prev]
      for (const ch of ev.changes) {
        const idx = Number(ch.rowKey)
        if (updated[idx]) {
          updated[idx] = { ...updated[idx], [ch.columnName]: ch.value }
        }
      }
      return updated
    })
  }, [])

  /* ── 변경된 행 계산 ── */
  const getChangedRows = useCallback(() => {
    const result: { empno: string; changes: Record<string, CellChange> }[] = []
    for (const [rk, cols] of Object.entries(changesMap)) {
      const realChanges: Record<string, CellChange> = {}
      for (const [col, change] of Object.entries(cols)) {
        if (String(change.before ?? '') !== String(change.after ?? '')) {
          realChanges[col] = change
        }
      }
      if (Object.keys(realChanges).length > 0) {
        const row = detailRows[Number(rk)]
        result.push({ empno: row?.EMPNO ?? rk, changes: realChanges })
      }
    }
    return result
  }, [changesMap, detailRows])

  const handleSaveClick = useCallback(() => {
    const changed = getChangedRows()
    if (changed.length === 0) {
      alert('변경된 내용이 없습니다.')
      return
    }
    setIsModalOpen(true)
  }, [getChangedRows])

  const handleConfirmSave = useCallback(async () => {
    setIsSaving(true)
    try {
      const changed = getChangedRows()
      const updateRows: EmpUpdateRow[] = changed.map(c => {
        const row = detailRows.find(r => r.EMPNO === c.empno)!
        return {
          EMPNO: c.empno,
          ENAME: row.ENAME ?? null,
          SAL: row.SAL != null ? String(row.SAL) : null,
          COMM: row.COMM != null ? String(row.COMM) : null,
        }
      })
      const result = await updateEmpRows(updateRows)
      alert(`${result.updated}건 수정 완료`)
      // 원본 갱신 & 변경맵 초기화
      originalRowsRef.current = detailRows.map(r => ({ ...r }))
      setChangesMap({})
      setIsModalOpen(false)
    } catch (err) {
      alert('수정 실패: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setIsSaving(false)
    }
  }, [getChangedRows, detailRows])

  const changedRows = isModalOpen ? getChangedRows() : []

  const COLUMN_LABELS: Record<string, string> = { ENAME: '이름', SAL: '급여', COMM: '커미션' }

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
            <Tab activeIndex={tabIndex} onChangeIndex={setTab}>
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
                    onAfterChange={handleDetailAfterChange}
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
            {changedRows.map(({ empno, changes }) => (
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
                    {Object.entries(changes).map(([col, { before, after }]) => (
                      <tr key={col}>
                        <td className="py-1 text-text-primary">{COLUMN_LABELS[col] ?? col}</td>
                        <td className="py-1 text-text-muted line-through">{String(before ?? '(없음)')}</td>
                        <td className="py-1 text-accent font-medium">{String(after ?? '(없음)')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
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
