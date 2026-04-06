/**
 * @route /new-search
 * @pattern Unified DataSource + Tab(Grid↔Chart) + Cell Double-Click
 * @description
 * 학습용 페이지. 다음 항목을 한 화면에서 비교 학습할 수 있도록 구성했다.
 *
 *  1) Input.dataSource의 4가지 입력 형태:
 *     SelectOption[] / string[] / () => Promise<SelectOption[]> / () => Promise<string[]>
 *
 *  2) 6개 Input의 옵션 데이터를 단일 condDataSource 객체에 통합 관리
 *     → 3가지 구현 방식(A/B/C)을 모두 작성하고 주석 토글로 전환 가능.
 *
 *  3) Search 결과(그리드 + 차트)를 4가지 패턴으로 구현하고 주석 토글로 전환 가능.
 *     - 방법 1: useState + Promise (디폴트, "먼저 끝난 쪽 먼저 출력" 만족)
 *     - 방법 2: useTransition × 2 (학습용 부정 예시 — 배칭 발생)
 *     - 방법 3: useActionState × 2 (React 19 표준)
 *     - 방법 4: Suspense + use(promise) (가장 React스러움)
 *
 *  4) CompGrid의 cell 더블클릭 → 차트 탭으로 자동 전환 + 차트 갱신.
 */
'use client'

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useTransition,
  useActionState,
  Suspense,
  use,
  startTransition as reactStartTransition,
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Input,
  SearchPanel,
  CompGrid,
  CompChart,
  Tab,
  TabSub,
  Panel,
} from '@/components/control'
import RouteInfo from '@/components/shared/RouteInfo'
import {
  fetchInput2Options,
  fetchInput3Options,
  fetchInput4Options,
  fetchInput6Options,
  fetchNewSearchGrid,
  fetchNewSearchChart,
  fetchChartByCell,
  type NewSearchCond,
  type NewSearchRow,
  type NewChartRow,
} from '@/actions/new-search'
import type { SelectOption, GridColumn } from '@/types'

/* ────────────────────────────────────────────────────────────
 * 타입 정의
 * ────────────────────────────────────────────────────────────*/

type SelectCondKey = 'i1' | 'i2' | 'i3' | 'i4' | 'i6'

interface CondValues {
  i1: string[]
  i2: string[]
  i3: string[]
  i4: string[]
  i5: string // text input
  i6: string[]
}

/** Input.dataSource가 받을 수 있는 모든 형태의 통합 타입 */
type AnyDataSource =
  | string[]
  | SelectOption[]
  | (() => Promise<string[]>)
  | (() => Promise<SelectOption[]>)

const EMPTY_COND: CondValues = {
  i1: [],
  i2: [],
  i3: [],
  i4: [],
  i5: '',
  i6: [],
}

/* Input 1에 직접 전달할 정적 string[] */
const I1_STATIC_OPTIONS: string[] = ['옵션1', '옵션2', '옵션3', '옵션4', '옵션5']

/* ────────────────────────────────────────────────────────────
 * 그리드 컬럼 정의
 * ────────────────────────────────────────────────────────────*/

const COLUMNS: GridColumn[] = [
  { key: 'id', label: 'ID', width: '70px', align: 'right' },
  { key: 'col1', label: 'COL1', width: '110px' },
  { key: 'col2', label: 'COL2', width: '110px' },
  { key: 'col3', label: 'COL3', width: '110px' },
  { key: 'col4', label: 'COL4', width: '110px' },
  { key: 'productName', label: '상품명', width: '180px' },
  {
    key: 'price',
    label: '가격',
    width: '110px',
    align: 'right',
    render: (value) => (value as number).toLocaleString('ko-KR') + '원',
  },
  { key: 'stock', label: '재고', width: '70px', align: 'right' },
  {
    key: 'status',
    label: '상태',
    width: '90px',
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
  { key: 'createdAt', label: '등록일', width: '110px' },
]

/* ────────────────────────────────────────────────────────────
 * (방법 C 전용) 캐스케이딩 dataSource를 useMemo로 캡슐화한 커스텀 훅
 *  — i6 사전로드 옵션은 외부에서 별도 state로 관리하여 deps로 주입
 * ────────────────────────────────────────────────────────────*/
function useCascadingDataSource(
  condValues: CondValues,
  i6Options: SelectOption[],
): Record<SelectCondKey, AnyDataSource> {
  return useMemo<Record<SelectCondKey, AnyDataSource>>(
    () => ({
      i1: I1_STATIC_OPTIONS,
      i2: () => fetchInput2Options(condValues.i1),
      i3: () => fetchInput3Options(condValues.i1, condValues.i2),
      i4: fetchInput4Options,
      i6: i6Options,
    }),
    [condValues.i1, condValues.i2, i6Options],
  )
}

export default function NewSearchPage() {
  /* ── 조건 값 ── */
  const [condValues, setCondValues] = useState<CondValues>(EMPTY_COND)

  /* condValues의 최신 값을 클로저 안에서 참조하기 위한 ref (방법 A에서 사용) */
  const condValuesRef = useRef(condValues)
  condValuesRef.current = condValues
  console.log(`CLIENT: condValuesRef.current.i1: ${condValuesRef.current.i1.map(v => v).join(',')}`)
  console.log(`CLIENT: condValuesRef.current.i2: ${condValuesRef.current.i2.map(v => v).join(',')}`)
  console.log(`CLIENT: condValuesRef.current.i3: ${condValuesRef.current.i3.map(v => v).join(',')}`)
  console.log(`CLIENT: condValuesRef.current.i4: ${condValuesRef.current.i4.map(v => v).join(',')}`)
  console.log(`CLIENT: condValuesRef.current.i5: ${condValuesRef.current.i5.toString()}`)
  console.log(`CLIENT: condValuesRef.current.i6: ${condValuesRef.current.i6.map(v => v).join(',')}`)

  /* ── Input 6의 사전 로드 옵션 ── */
  const [i6Options, setI6Options] = useState<SelectOption[]>([])
  const [loadingI6, setLoadingI6] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchInput6Options()
      .then((opts) => {
        if (!cancelled) setI6Options(opts)
      })
      .finally(() => {
        if (!cancelled) setLoadingI6(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  /* ════════════════════════════════════════════════════════════
   * 통합 dataSource 상태 관리 — 3가지 방법 비교
   *
   * | 방법 | 핵심 | 장점 | 단점 |
   * | A    | 단일 객체 + 런타임 union | 가장 단순, Input에 그대로 전달 | 함수 안에서 최신 cond를 보려면 ref 또는 매번 재생성 필요 |
   * | B    | discriminated union     | 타입 narrowing 명시적, 디버깅 용이 | 보일러플레이트 증가 |
   * | C    | useMemo 커스텀 훅       | deps로 캐스케이드 자동 처리, 가장 React스러움 | 사전로드 옵션은 별도 state 필요 |
   *
   * 디폴트: 방법 A 활성. B/C는 큰 주석 블록.
   * ════════════════════════════════════════════════════════════*/

  /* ─────── 방법 A — 단일 객체 + 런타임 union (활성) ─────── */
  const [condDataSource, setCondDataSource] = useState<Record<SelectCondKey, AnyDataSource>>(
    () => ({
      i1: I1_STATIC_OPTIONS,
      i2: () => fetchInput2Options(condValuesRef.current.i1),
      i3: () => fetchInput3Options(condValuesRef.current.i1, condValuesRef.current.i2),
      i4: fetchInput4Options,
      i6: [], // 마운트 직후 useEffect가 채움
    }),
  )

  /* i6 사전 로드 결과를 condDataSource에 반영 (방법 A 전용) */
  useEffect(() => {
    setCondDataSource(prev => ({ ...prev, i6: i6Options }))
  }, [i6Options])

  /* ─────── 방법 B — discriminated union (주석 처리) ───────
  type DSEntry =
    | { kind: 'static-strings'; value: string[] }
    | { kind: 'static-options'; value: SelectOption[] }
    | { kind: 'fetcher-strings'; fn: () => Promise<string[]> }
    | { kind: 'fetcher-options'; fn: () => Promise<SelectOption[]> }

  const [condDataSourceB, setCondDataSourceB] = useState<Record<SelectCondKey, DSEntry>>(() => ({
    i1: { kind: 'static-strings', value: I1_STATIC_OPTIONS },
    i2: { kind: 'fetcher-options', fn: () => fetchInput2Options(condValuesRef.current.i1) },
    i3: { kind: 'fetcher-options', fn: () => fetchInput3Options(condValuesRef.current.i1, condValuesRef.current.i2) },
    i4: { kind: 'fetcher-strings', fn: fetchInput4Options },
    i6: { kind: 'static-options', value: [] },
  }))

  function unwrap(e: DSEntry): AnyDataSource {
    switch (e.kind) {
      case 'static-strings': return e.value
      case 'static-options': return e.value
      case 'fetcher-strings':
      case 'fetcher-options': return e.fn
    }
  }
  // 사용 시: <Input dataSource={unwrap(condDataSourceB.i1)} ... />
  ──────────────────────────────────────────────────────────── */

  /* ─────── 방법 C — useMemo 커스텀 훅 (주석 처리) ───────
  
  // 사용 시: <Input dataSource={condDataSourceC.i1} ... />
  ──────────────────────────────────────────────────────────── */
  // const condDataSource = useCascadingDataSource(condValues, i6Options)

  // 방법 C 훅이 import되어 있어야 주석 해제 시 즉시 사용 가능 (lint 회피)
  void useCascadingDataSource

  /* ────────────────────────────────────────────────────────────
   * 캐스케이드 핸들러
   * - 방법 A에서는 함수 참조를 새로 만들어 Input 캐시를 무효화한다.
   * - 방법 C로 바꾸면 useMemo의 deps가 자동 처리하므로 여기서 setCondDataSource 호출 불필요.
   * ────────────────────────────────────────────────────────────*/
  /**
   * 5개 select Input의 onChange를 단일 핸들러로 통합.
   * Input.tsx의 select onChange는 (selected, id) 시그니처로 id를 함께 넘겨주므로
   * id 기반 switch로 분기한다. i1/i2 변경 시에는 하위 cascade 값도 초기화한다.
   */
  const handleSelectChange = useCallback((next: string[], id?: string) => {
    switch (id) {
      case 'i1':
        setCondValues(prev => ({ ...prev, i1: next, i2: [], i3: [] }))
        setCondDataSource(prev => ({
          ...prev,
          /* 새 함수 참조 → Input 내부 fetchedFnRef와 달라져서 다음 open 시 재fetch */
          i2: () => fetchInput2Options(next),
          i3: () => fetchInput3Options(next, []),
        }))
        break
      case 'i2':
        setCondValues(prev => ({ ...prev, i2: next, i3: [] }))
        setCondDataSource(prev => ({
          ...prev,
          i3: () => fetchInput3Options(condValuesRef.current.i1, next),
        }))
        break
      case 'i3':
        setCondValues(prev => ({ ...prev, i3: next }))
        break
      case 'i4':
        setCondValues(prev => ({ ...prev, i4: next }))
        break
      case 'i6':
        setCondValues(prev => ({ ...prev, i6: next }))
        break
    }
  }, [])

  /* ════════════════════════════════════════════════════════════
   * Grid / Chart 결과 fetch — 4가지 방법 비교
   *
   * 요구사항:
   *  (a) 로딩 표시
   *  (b) 에러 처리
   *  (c) "먼저 완료된 쪽이 먼저 출력" — 두 결과를 배칭하지 않음
   *
   * 디폴트: 방법 1 활성. 2/3/4는 큰 주석 블록.
   * ════════════════════════════════════════════════════════════*/

  /* ── 공통: 결과 state ── */
  const [gridData, setGridData] = useState<NewSearchRow[]>([])
  const [chartData, setChartData] = useState<NewChartRow[]>([])

  /* race condition 방지용 fetch id */
  const fetchIdRef = useRef({ grid: 0, chart: 0 })

  /* fatal error → render 중 throw하여 Error Boundary로 위임 */
  const [fatalError, setFatalError] = useState<Error | null>(null)
  if (fatalError) throw fatalError

  /* ─────── 방법 1 — useState + Promise (활성, 권장 디폴트) ───────
   * 장점: 두 fetch가 완전히 독립이므로 먼저 끝난 쪽이 즉시 화면에 반영됨.
   *       단순하고 디버깅 쉬움.
   * 단점: race id, finally 등 보일러플레이트.
   * ──────────────────────────────────────────────────────────── */
  const [isGridPending, setIsGridPending] = useState(false)
  const [isChartPending, setIsChartPending] = useState(false)

  // function runGridFetch(cond: NewSearchCond) {
  //   const id = ++fetchIdRef.current.grid
  //   setIsGridPending(true)
  //   fetchNewSearchGrid(cond)
  //     .then((data) => {
  //       if (fetchIdRef.current.grid === id) setGridData(data)
  //     })
  //     .catch((e) => setFatalError(e instanceof Error ? e : new Error(String(e))))
  //     .finally(() => {
  //       if (fetchIdRef.current.grid === id) setIsGridPending(false)
  //     })
  // }

  // function runChartFetch(cond: NewSearchCond) {
  //   const id = ++fetchIdRef.current.chart
  //   setIsChartPending(true)
  //   fetchNewSearchChart(cond)
  //     .then((data) => {
  //       if (fetchIdRef.current.chart === id) setChartData(data)
  //     })
  //     .catch((e) => setFatalError(e instanceof Error ? e : new Error(String(e))))
  //     .finally(() => {
  //       if (fetchIdRef.current.chart === id) setIsChartPending(false)
  //     })
  // }

  function handleSearchClick() {
    const cond: NewSearchCond = { ...condValues }
    // runGridFetch(cond)
    // runChartFetch(cond)
    const gridId = ++fetchIdRef.current.grid
    setIsGridPending(true)
    fetchNewSearchGrid(cond)
      .then((data) => {
        if (fetchIdRef.current.grid === gridId) setGridData(data)
      })
      .catch((e) => setFatalError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => {
        if (fetchIdRef.current.grid === gridId) setIsGridPending(false)
      })

    const chartId = ++fetchIdRef.current.chart
    setIsChartPending(true)
    fetchNewSearchChart(cond)
      .then((data) => {
        console.log(`CLIENT: fetchNewSearchChart - data: ${data}`)
        if (fetchIdRef.current.chart === chartId) setChartData(data)
      })
      .catch((e) => setFatalError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => {
        if (fetchIdRef.current.chart === chartId) setIsChartPending(false)
      })
  }

  /* ─────── 방법 2 — useTransition × 2 (학습용 부정 예시, 주석) ───────
   * 장점: 코드 짧음, pending 자동 관리, UI freeze 방지.
   * 단점: ⚠️ 두 transition이 동시에 pending이면 React concurrent 스케줄러가
   *       커밋을 배칭하여 먼저 끝난 쪽 결과가 보류된다.
   *       → "먼저 출력" 요구사항 위배 가능.
   *
  const [isGridPending2, startGridTransition] = useTransition()
  const [isChartPending2, startChartTransition] = useTransition()

  function handleSearchClick() {
    const cond: NewSearchCond = { ...condValues }
    startGridTransition(async () => {
      try {
        const data = await fetchNewSearchGrid(cond)
        setGridData(data)
      } catch (e) {
        setFatalError(e instanceof Error ? e : new Error(String(e)))
      }
    })
    startChartTransition(async () => {
      try {
        const data = await fetchNewSearchChart(cond)
        setChartData(data)
      } catch (e) {
        setFatalError(e instanceof Error ? e : new Error(String(e)))
      }
    })
  }
  ──────────────────────────────────────────────────────────── */

  /* ─────── 방법 3 — useActionState × 2 (React 19 표준, 주석) ───────
   * 장점: React 19 권장 패턴, prev state 활용 가능, form action으로도 연결 가능.
   * 단점: 내부적으로 transition 기반이라 방법 2와 동일한 batching 이슈 가능.
   *       에러는 throw가 아니라 state로 잡으려면 try/catch로 감싸야 함.
   *
  const [gridState, gridAction, isGridPending3] = useActionState<NewSearchRow[], NewSearchCond>(
    async (_prev, cond) => {
      try {
        return await fetchNewSearchGrid(cond)
      } catch (e) {
        setFatalError(e instanceof Error ? e : new Error(String(e)))
        return _prev
      }
    },
    [],
  )
  const [chartState, chartAction, isChartPending3] = useActionState<NewChartRow[], NewSearchCond>(
    async (_prev, cond) => {
      try {
        return await fetchNewSearchChart(cond)
      } catch (e) {
        setFatalError(e instanceof Error ? e : new Error(String(e)))
        return _prev
      }
    },
    [],
  )

  function handleSearchClick() {
    const cond: NewSearchCond = { ...condValues }
    reactStartTransition(() => {
      gridAction(cond)
      chartAction(cond)
    })
  }
  // <CompGrid data={gridState} loading={isGridPending3} ... />
  // <CompChart data={chartState} loading={isChartPending3} ... />
  ──────────────────────────────────────────────────────────── */

  /* ─────── 방법 4 — Suspense + use(promise) (가장 React스러움, 주석) ───────
   * 장점: 두 Suspense boundary가 독립이라 batching 문제 없음.
   *       선언적, React 19 정수.
   * 단점: 렌더 트리에 Suspense boundary 추가 필요. 에러는 ErrorBoundary로 별도 처리.
   *       fetch 트리거가 setState(promise) 형태라 약간 어색.
   *
  const [gridPromise, setGridPromise] = useState<Promise<NewSearchRow[]> | null>(null)
  const [chartPromise, setChartPromise] = useState<Promise<NewChartRow[]> | null>(null)

  function handleSearchClick() {
    const cond: NewSearchCond = { ...condValues }
    setGridPromise(fetchNewSearchGrid(cond))
    setChartPromise(fetchNewSearchChart(cond))
  }

  function GridResolver({ promise }: { promise: Promise<NewSearchRow[]> }) {
    const data = use(promise)
    return <CompGrid columns={COLUMNS} data={data as Record<string, unknown>[]} height="500px" />
  }
  function ChartResolver({ promise }: { promise: Promise<NewChartRow[]> }) {
    const data = use(promise)
    return <CompChart data={data} title="검색 결과" height="320px" />
  }

  // <Suspense fallback={<CompGrid.Skeleton columns={COLUMNS} height="500px" />}>
  //   {gridPromise && <GridResolver promise={gridPromise} />}
  // </Suspense>
  // <Suspense fallback={<CompChart.Skeleton ... />}>
  //   {chartPromise && <ChartResolver promise={chartPromise} />}
  // </Suspense>
  ──────────────────────────────────────────────────────────── */

  /* lint 회피 — 주석 처리된 방법들이 import한 식별자 보존 */
  void useTransition
  void useActionState
  void Suspense
  void use
  void reactStartTransition

  /* ────────────────────────────────────────────────────────────
   * 셀 더블클릭 → 차트 갱신 + 차트 탭으로 전환
   * ────────────────────────────────────────────────────────────*/
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = Number(searchParams.get('tab') ?? 0)
  const setActiveTab = useCallback(
    (idx: number) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', String(idx))
      router.push(`?${params.toString()}`, { scroll: false })
    },
    [router, searchParams],
  )

  const handleCellDoubleClick = useCallback(
    (value: unknown, column: GridColumn) => {
      const id = ++fetchIdRef.current.chart
      setIsChartPending(true)
      fetchChartByCell(column.key, value)
        .then((data) => {
          if (fetchIdRef.current.chart === id) setChartData(data)
        })
        .catch((e) => setFatalError(e instanceof Error ? e : new Error(String(e))))
        .finally(() => {
          if (fetchIdRef.current.chart === id) setIsChartPending(false)
        })
      setActiveTab(1)
    },
    [],
  )

  /* ────────────────────────────────────────────────────────────
   * 렌더
   * ────────────────────────────────────────────────────────────*/
  return (
    <main className="min-h-screen bg-bg-primary px-4 py-6">
      <div className="mx-auto max-w-[1400px]">
        <h1 className="mb-6 text-2xl font-bold text-text-primary">
          NewSearch (통합 dataSource + Grid↔Chart 탭)
        </h1>

        <div className="flex gap-6 items-start">
          {/* 좌측 SearchPanel */}
          <SearchPanel
            label="Search Panel"
            onSearchClick={handleSearchClick}
            isLoading={isGridPending || isChartPending}
          >
            <Input
              id='i1'
              type="select"
              label="Input 1 (정적 string[])"
              value={condValues.i1}
              onChange={handleSelectChange}
              dataSource={condDataSource.i1}
              helperText={`${I1_STATIC_OPTIONS.length}건 (정적)`}
            />
            <Input
              id='i2'
              type="select"
              label="Input 2 (i1 cascade)"
              value={condValues.i2}
              onChange={handleSelectChange}
              dataSource={condDataSource.i2}
              helperText="드롭다운 열면 조회 (Input 1 기반)"
            />
            <Input
              id='i3'
              type="select"
              label="Input 3 (i1+i2 cascade)"
              value={condValues.i3}
              onChange={handleSelectChange}
              dataSource={condDataSource.i3}
              helperText="드롭다운 열면 조회 (Input 1+2 기반)"
            />
            <Input
              id='i4'
              type="select"
              label="Input 4 (string[] fetcher)"
              value={condValues.i4}
              onChange={handleSelectChange}
              dataSource={condDataSource.i4}
              helperText="string[] 반환 함수형 dataSource"
            />
            <Input
              id='i5'
              type="text"
              label="Input 5 (text)"
              value={condValues.i5}
              onChange={(e) => setCondValues(prev => ({ ...prev, i5: e.target.value }))}
              placeholder="자유 입력"
            />
            <Input
              id='i6'
              type="select"
              label="Input 6 (사전로드 SelectOption[])"
              value={condValues.i6}
              onChange={handleSelectChange}
              dataSource={condDataSource.i6}
              helperText={loadingI6 ? '데이터 로딩 중...' : `${i6Options.length}건`}
            />
          </SearchPanel>

          {/* 우측 콘텐츠: Tab(Grid / Chart) */}
          <div className="flex-1 min-w-0">
            <Panel variant="outlined">
              <Tab activeIndex={activeTab} onChangeIndex={setActiveTab}>
                <TabSub label="검색 결과 (Grid)">
                  <CompGrid
                    columns={COLUMNS}
                    data={gridData as unknown as Record<string, unknown>[]}
                    loading={isGridPending}
                    onCellDoubleClick={handleCellDoubleClick}
                    height="500px"
                  />
                  <p className="mt-2 text-xs text-text-muted">
                    💡 셀을 더블클릭하면 해당 값 기반의 차트가 두번째 탭에 표시됩니다.
                  </p>
                </TabSub>
                <TabSub label="차트 (Chart)">
                  <CompChart
                    data={chartData}
                    loading={isChartPending}
                    title="상태별 분포"
                    height="320px"
                  />
                </TabSub>
              </Tab>
            </Panel>
          </div>
        </div>

        <div className="mt-6">
          <RouteInfo
            pattern="Unified DataSource + Tab(Grid↔Chart) + Cell Double-Click"
            syntax="app/new-search/page.tsx"
            description="6개 Input의 dataSource(string[]/SelectOption[]/함수)를 단일 객체로 통합 관리하고, 그리드/차트 fetch 패턴 4가지와 dataSource 관리 방식 3가지를 주석 토글로 비교 학습할 수 있는 페이지입니다. 그리드 셀 더블클릭으로 차트 탭이 자동 전환됩니다."
            docsUrl="https://react.dev/reference/react/useActionState"
          />
        </div>
      </div>
    </main>
  )
}
