/**
 * @route /comp-search
 * @pattern useTransition + Compound Component (CompGrid / CompChart)
 * @description
 * 두 개의 독립적인 useTransition 훅으로 Grid와 Chart를 동시에 조회하되,
 * 각각 먼저 완료되는 순서대로 스켈레톤이 해제되어 표시되는 패턴.
 *
 * CompGrid, CompChart는 `loading` prop만 전달하면 내장 스켈레톤을
 * 자동 렌더링하므로 <Suspense fallback={}> 래핑이 필요 없다.
 *
 * React 19의 useTransition은 async 콜백을 지원하여
 * startTransition(async () => { ... }) 형태로 Server Action을 호출할 수 있다.
 */
'use client'

import { useState, useEffect, useRef, useCallback, useMemo, useTransition } from 'react'
import { Input, SearchPanel, CompGrid, CompChart } from '@/components/control'
import RouteInfo from '@/components/shared/RouteInfo'
import { fetchChartData, fetchItemDataSource, fetchSearchResults } from '@/actions/search'
import type { ItemType, SearchResultRow, ChartDataRow } from '@/actions/search'
import type { SelectOption, GridColumn } from '@/types'

/* ── 타입 정의 ── */
type CondKey = 'itemA' | 'itemB' | 'itemC'
type CondDataSource = Record<CondKey, SelectOption[]>
type CondValues = Record<CondKey, string[]>

const EMPTY_DS: CondDataSource = { itemA: [], itemB: [], itemC: [] }
const EMPTY_VALUES: CondValues = { itemA: [], itemB: [], itemC: [] }

/* ── 그리드 컬럼 정의 ── */
const COLUMNS: GridColumn[] = [
  { key: 'id', label: 'ID', width: '80px' },
  { key: 'itemA', label: 'ITEM-A', width: '120px' },
  { key: 'itemB', label: 'ITEM-B', width: '120px' },
  { key: 'itemC', label: 'ITEM-C', width: '120px' },
  { key: 'productName', label: '상품명', width: '180px' },
  {
    key: 'price',
    label: '가격',
    width: '120px',
    align: 'right',
    render: (value) => (value as number).toLocaleString('ko-KR') + '원',
  },
  { key: 'stock', label: '재고', width: '80px', align: 'right' },
  {
    key: 'status',
    label: '상태',
    width: '100px',
    render: (value) => {
      const status = value as string
      const colorClass =
        status === '판매중' ? 'bg-success/15 text-success' :
          status === '품절' ? 'bg-error/15 text-error' :
            status === '할인중' ? 'bg-info/15 text-info' :
              status === '단종' ? 'bg-text-muted/15 text-text-muted' :
                'bg-warning/15 text-warning'
      return (
        <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${colorClass}`}>
          {status}
        </span>
      )
    },
  },
  { key: 'createdAt', label: '등록일', width: '120px' },
]

export default function CompSearchPage() {
  /* ── DataSource 상태 ── */
  const [condDataSource, setCondDataSource] = useState<CondDataSource>({ ...EMPTY_DS })
  const [condValues, setCondValues] = useState<CondValues>({ ...EMPTY_VALUES })
  const [loadingDS, setLoadingDS] = useState<Record<CondKey, boolean>>({
    itemA: true, itemB: false, itemC: false,
  })

  /* ── 결과 데이터 ── */
  const [gridData, setGridData] = useState<SearchResultRow[]>([])
  const [chartData, setChartData] = useState<ChartDataRow[]>([])

  /* ── 독립적인 useTransition 훅 2개 ── */
  /* useTransition은 concurrent 스케줄러가 커밋 타이밍을 제어하므로,
     두 transition이 동시에 pending일 때 배칭되어 먼저 완료된 쪽이 보류될 수 있다. */
  // const [isGridPending, startGridTransition] = useTransition()
  // const [isChartPending, startChartTransition] = useTransition()

  /* ── 독립적인 로딩 상태 (useTransition 대신 수동 관리) ── */
  /* 일반 setState는 호출 즉시 re-render를 트리거하므로 먼저 완료된 쪽부터 즉시 렌더링된다. */
  const [isGridPending, setIsGridPending] = useState(false)
  const [isChartPending, setIsChartPending] = useState(false)

  /* ── 에러 상태: 렌더링 중 throw하여 error.tsx(Error Boundary)로 전파 ── */
  const [fatalError, setFatalError] = useState<Error | null>(null)
  if (fatalError) throw fatalError

  /* ── Race condition 방지 ── */
  const fetchIdRef = useRef<{ C: number; grid: number; chart: number }>({ C: 0, grid: 0, chart: 0 })

  /* ── 마운트 시 ITEM-A 로드 (ITEM-B는 함수형 dataSource로 지연 로딩) ── */
  useEffect(() => {
    async function loadInitialDS() {
      const a = await fetchItemDataSource('A')
      setCondDataSource(prev => ({ ...prev, itemA: a }))
      setLoadingDS(prev => ({ ...prev, itemA: false }))
    }
    loadInitialDS()
  }, [])

  /* ── ITEM-B: 드롭다운 열 때 지연 로딩되는 함수형 dataSource ── */
  // const itemBFetcher = useMemo(
  //   () => fetchItemDataSource.bind(null, 'B', condValues.itemA),
  //   [condValues.itemA],
  // )
  const itemBFetcher = useMemo(() => {
    console.log(`CLIENT: itemBFetcher: condValues: ${condValues.itemA.map((v) => v)}`);
    return fetchItemDataSource.bind(null, 'B', condValues.itemA)
  }, [condValues.itemA])

  /* ── 캐스케이딩 핸들러 ── */
  const handleItemChange = useCallback(async (type: ItemType, newSelected: string[]) => {
    switch (type) {
      case 'A': {
        console.log(`handleItemChange A: ${newSelected.map((v) => v)}`);
        setCondValues(prev => ({ ...prev, itemA: newSelected, itemB: [], itemC: [] }))
        setCondDataSource(prev => ({ ...prev, itemC: [] }))
        break
      }
      case 'B': {
        console.log(`handleItemChange B: ${newSelected.map((v) => v)}`);
        setCondValues(prev => ({ ...prev, itemB: newSelected, itemC: [] }))

        if (newSelected.length > 0) {
          const id = ++fetchIdRef.current.C
          // const id = (fetchIdRef.current.get('C') ?? 0) + 1
          setLoadingDS(prev => ({ ...prev, itemC: true }))
          const c = await fetchItemDataSource('C', [...condValues.itemA, ...newSelected])
          if (fetchIdRef.current.C === id) {
            setCondDataSource(prev => ({ ...prev, itemC: c }))
            setLoadingDS(prev => ({ ...prev, itemC: false }))
          }
        } else {
          setCondDataSource(prev => ({ ...prev, itemC: [] }))
        }
        break
      }
      case 'C': {
        console.log(`handleItemChange C: ${newSelected.map((v) => v)}`);
        setCondValues(prev => ({ ...prev, itemC: newSelected }))
        break
      }
    }
  }, [condValues.itemA])

  /* ── 검색 실행: 두 fetch를 독립적인 HTTP 요청으로 병렬 시작 ── */
  function handleSearchClick() {
    const { itemA, itemB, itemC } = condValues
    const body = JSON.stringify({ selectedA: itemA, selectedB: itemB, selectedC: itemC })

    /* ▸ 방법 1) Server Action 직접 호출 (useTransition — 배칭으로 동시 렌더링됨)
     *   두 startTransition이 동시에 pending이면 React concurrent 스케줄러가
     *   먼저 완료된 쪽의 커밋을 보류하여 결국 두 결과가 한 번에 그려진다. */
    // startGridTransition(async () => {
    //   const data = await fetchSearchResults(itemA, itemB, itemC)
    //   setGridData(data)
    // })
    // startChartTransition(async () => {
    //   const data = await fetchChartData(itemA, itemB, itemC)
    //   setChartData(data)
    // })

    /* ▸ 방법 1-1) Server Action 직접 호출 + 수동 state (독립 렌더링)
     *   useTransition 없이 setState로 pending을 관리하므로
     *   먼저 완료된 쪽부터 즉시 화면에 반영된다. */
    const gridId = ++fetchIdRef.current.grid
    setIsGridPending(true)
    fetchSearchResults(itemA, itemB, itemC)
      .then((data) => {
        if (fetchIdRef.current.grid === gridId) {
          setGridData(data)
        }
      })
      .catch((e) => setFatalError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => {
        if (fetchIdRef.current.grid === gridId) {
          setIsGridPending(false)
        }
      })

    const chartId = ++fetchIdRef.current.chart
    setIsChartPending(true)
    fetchChartData(itemA, itemB, itemC)
      .then((data) => {
        if (fetchIdRef.current.chart === chartId) {
          setChartData(data)
        }
      })
      .catch((e) => setFatalError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => {
        if (fetchIdRef.current.chart === chartId) {
          setIsChartPending(false)
        }
      })

    /* ▸ 방법 2) Route Handler fetch + useTransition (동일하게 배칭됨) */
    // startGridTransition(async () => {
    //   const res = await fetch('/api/comp-search/grid', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
    //   const data: SearchResultRow[] = await res.json()
    //   setGridData(data)
    // })

    /* ▸ 방법 3) Route Handler fetch + 수동 state (독립 fetch — 완료 즉시 렌더링) */
    // const gridId = ++fetchIdRef.current.grid
    // setIsGridPending(true)
    // fetch('/api/comp-search/grid', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
    //   .then(res => res.json())
    //   .then((data: SearchResultRow[]) => {
    //     if (fetchIdRef.current.grid === gridId) {
    //       setGridData(data)
    //       setIsGridPending(false)
    //     }
    //   })

    // /* ▸ 방법 3) Route Handler fetch + 수동 state (독립 fetch — 완료 즉시 렌더링) */
    // const chartId = ++fetchIdRef.current.chart
    // setIsChartPending(true)
    // fetch('/api/comp-search/chart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
    //   .then(res => res.json())
    //   .then((data: ChartDataRow[]) => {
    //     if (fetchIdRef.current.chart === chartId) {
    //       setChartData(data)
    //       setIsChartPending(false)
    //     }
    //   })
  }

  return (
    <main className="min-h-screen bg-bg-primary px-4 py-6">
      <div className="mx-auto max-w-[1400px]">
        <h1 className="mb-6 text-2xl font-bold text-text-primary">
          CompSearch (useTransition + 독립 로딩)
        </h1>

        <div className="flex gap-6 items-start">
          {/* 좌측 SearchPanel */}
          <SearchPanel
            label="Search Panel"
            onSearchClick={handleSearchClick}
            isLoading={isGridPending || isChartPending}
          >
            <Input
              label="ITEM-A"
              type="select"
              value={condValues.itemA}
              onChange={(selected) => handleItemChange('A', selected)}
              dataSource={condDataSource.itemA}
              helperText={loadingDS.itemA ? '데이터 로딩 중...' : `${condDataSource.itemA.length}건`}
            />
            <Input
              label="ITEM-B"
              type="select"
              value={condValues.itemB}
              onChange={(selected) => handleItemChange('B', selected)}
              dataSource={itemBFetcher}
              helperText="드롭다운을 열면 데이터를 조회합니다"
            />
            <Input
              label="ITEM-C"
              type="select"
              value={condValues.itemC}
              onChange={(selected) => handleItemChange('C', selected)}
              dataSource={condDataSource.itemC}
              disabled={condValues.itemB.length === 0}
              helperText={loadingDS.itemC ? '데이터 로딩 중...' : condValues.itemB.length === 0 ? 'ITEM-B를 먼저 선택하세요' : `${condDataSource.itemC.length}건`}
            />
          </SearchPanel>

          {/* 우측 콘텐츠: Chart(상단) + Grid(하단) */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            {/* CompChart — loading prop으로 자동 스켈레톤 */}
            <CompChart
              data={chartData}
              loading={isChartPending}
              title="상태별 분포"
              height="280px"
            />

            {/* CompGrid — loading prop으로 자동 스켈레톤 */}
            <CompGrid
              columns={COLUMNS}
              data={gridData as unknown as Record<string, unknown>[]}
              loading={isGridPending}
              height="500px"
            />
          </div>
        </div>

        <div className="mt-6">
          <RouteInfo
            pattern="useTransition + Compound Component (독립 로딩)"
            syntax="app/comp-search/page.tsx"
            description="두 개의 독립적인 useTransition으로 그리드와 차트를 동시에 조회하되, 각각 먼저 완료되는 순서대로 표시하는 패턴입니다. CompGrid와 CompChart는 loading prop으로 내장 스켈레톤을 자동 렌더링합니다."
            docsUrl="https://react.dev/reference/react/useTransition"
          />
        </div>
      </div>
    </main>
  )
}
