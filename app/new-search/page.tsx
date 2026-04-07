/**
 * @route /new-search
 * @pattern Unified DataSource (useMemo) + useActionState (Server Action)
 * @description
 * React 19 + Next.js 16 표준 아키텍처 적용 버전.
 * - useRef, 수동 Promise 핸들링 제거
 * - useActionState를 통한 비동기 상태(pending, data) 자동 관리
 * - useMemo를 활용한 선언적 DataSource 캐스케이딩 (방법 C 적용)
 */
'use client'

import {
    useState,
    useEffect,
    useCallback,
    useMemo,
    useActionState,
    startTransition,
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
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
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
import { DataSource } from '@/components/control/Input'

/* ────────────────────────────────────────────────────────────
 * 타입 정의
 * ────────────────────────────────────────────────────────────*/

// type SelectCondKey = 'i1' | 'i2' | 'i3' | 'i4' | 'i6' // 3-old(단일 useMemo) 구현에서만 사용되던 키 유니온

interface CondValues {
    i1: string[]
    i2: string[]
    i3: string[]
    i4: string[]
    i5: string
    i6: string[]
}

// type AnyDataSource =
//     | string[]
//     | SelectOption[]
//     | (() => Promise<string[]>)
//     | (() => Promise<SelectOption[]>)

// const EMPTY_COND: CondValues = {
//     i1: [], i2: [], i3: [], i4: [], i5: '', i6: [],
// }

const I1_STATIC_OPTIONS: string[] = ['옵션1', '옵션2', '옵션3', '옵션4', '옵션5']

/* 차트 Action의 Payload 타입 (검색 버튼 vs 셀 더블클릭 분기용) */
type ChartActionPayload =
    | { type: 'SEARCH'; cond: NewSearchCond }
    | { type: 'CELL_DOUBLE_CLICK'; key: string; value: unknown }

/* ────────────────────────────────────────────────────────────
 * 비동기 Action 상태 타입 (에러 격리를 위한 래핑)
 * - fetch 실패 시 이전 데이터를 유지하면서 에러 메시지를 함께 보관한다.
 * - 그리드/차트가 서로 독립적으로 에러 상태를 가질 수 있어야
 *   한쪽이 실패해도 다른 쪽은 정상 렌더된다.
 * ────────────────────────────────────────────────────────────*/
interface GridState {
    data: NewSearchRow[]
    error: string | null
}
interface ChartState {
    data: NewChartRow[]
    error: string | null
}

/* ────────────────────────────────────────────────────────────
 * 그리드 컬럼 정의 (이전과 동일)
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

export default function NewSearchPage() {
    /* ── 1. 조건 값 상태 관리 ── */
    const [condValues, setCondValues] = useState<CondValues>({ i1: [], i2: [], i3: [], i4: [], i5: '', i6: [], })

    /* ── 2. Input 6 사전 로드 (필요시 이 부분도 Suspense로 분리 가능) ── */
    const [i6Options, setI6Options] = useState<SelectOption[]>([])
    const [loadingI6, setLoadingI6] = useState(true)

    useEffect(() => {
        let cancelled = false
        fetchInput6Options()
            .then((opts) => { if (!cancelled) setI6Options(opts) })
            .finally(() => { if (!cancelled) setLoadingI6(false) })
        return () => { cancelled = true }
    }, [])

    /* ── 3. [A-1 적용] 필드별 useCallback/useMemo로 참조 안정화 ──
     * 각 dataSource를 "자신의 진짜 의존성"만으로 메모이즈한다.
     *
     * 배경: 아래 주석 처리된 단일 useMemo 구현(3-old)은 condValues.i2를
     * deps에 포함하고 있어, i2에서 값을 선택할 때마다 condDataSource.i2의
     * 함수 참조가 새로 생성되었다. 그 결과 Input 내부의 옵션 캐시가
     * 무효화되어, 드롭다운을 닫은 상태에서 선택된 value ↔ label 매칭이
     * 풀리고 placeholder("선택하세요")가 아닌 일반 텍스트(진한 색상)로
     * 잘못 표시되는 이상 증상이 발생했다.
     *
     * 필드별로 분리하면 i2의 참조는 오직 condValues.i1이 바뀔 때만
     * 갱신되므로 자기 자신을 선택해도 참조가 안정적이다. (i3는 여전히
     * condValues.i2가 바뀌면 참조가 갱신되지만, handleSelectChange에서
     * i3: []로 리셋하므로 이상 라벨이 드러나지 않는다.)
     */
    const i1DataSource = useMemo<DataSource>(() => I1_STATIC_OPTIONS, [])

    const i2DataSource = useCallback(
        () => fetchInput2Options(condValues.i1),
        [condValues.i1]
    )

    const i3DataSource = useCallback(
        () => fetchInput3Options(condValues.i1, condValues.i2),
        [condValues.i1, condValues.i2]
    )

    const i4DataSource: DataSource = fetchInput4Options

    // i6은 기존대로 i6Options 상태값을 그대로 dataSource로 사용한다.

    /* ── 3-old. [이전 구현: 단일 useMemo 방식 — 참고용 보존] ──
     * 원본 상태(condValues)가 변경되면 파생 상태(condDataSource)는
     * 자동으로 재계산되도록 한 "단방향 캐스케이딩 DataSource" 구현.
     * 수동 동기화는 사라졌지만, 위에서 설명한 i2 자기참조 무효화 문제로
     * 인해 3-new(A-1) 방식으로 대체되었다.
     *
     * const condDataSource = useMemo<Record<SelectCondKey, DataSource>>(() => ({
     *     i1: ['옵션1', '옵션2', '옵션3', '옵션4', '옵션5'],
     *     i2: () => fetchInput2Options(condValues.i1),
     *     i3: () => fetchInput3Options(condValues.i1, condValues.i2),
     *     i4: fetchInput4Options,
     *     i6: i6Options,
     * }), [condValues.i1, condValues.i2, i6Options])
     */

    const handleSelectChange = useCallback((next: string[], id?: string) => {
        setCondValues((prev) => {
            console.log(`CLIENT: handleSelectChange - id: ${id}, next: ${next.join(',')}`)
            switch (id) {
                case 'i1': return { ...prev, i1: next, i2: [], i3: [] } // 하위 의존성 초기화
                case 'i2': return { ...prev, i2: next, i3: [] }
                case 'i3': return { ...prev, i3: next }
                case 'i4': return { ...prev, i4: next }
                case 'i6': return { ...prev, i6: next }
                default: return prev
            }
        })
    }, [])

    /* ── 4. [React 19 표준] useActionState를 통한 데이터 페칭 ── */

    // Grid 결과 관리 — 에러를 상태에 포함해 차트 영역과 격리
    const [gridState, dispatchGrid, isGridPending] = useActionState<GridState, NewSearchCond>(
        async (prevState, currentCond) => {
            try {
                const data = await fetchNewSearchGrid(currentCond)
                return { data, error: null }
            } catch (error) {
                console.error("Grid Fetch Error:", error)
                return {
                    data: prevState.data, // 이전 데이터 유지
                    error: error instanceof Error ? error.message : '그리드 조회 실패',
                }
            }
        },
        { data: [], error: null }
    )

    // Chart 결과 관리 (검색 조건 OR 셀 더블클릭 모두 처리)
    const [chartState, dispatchChart, isChartPending] = useActionState<ChartState, ChartActionPayload>(
        async (prevState, payload) => {
            try {
                if (payload.type === 'SEARCH') {
                    const data = await fetchNewSearchChart(payload.cond)
                    return { data, error: null }
                } else if (payload.type === 'CELL_DOUBLE_CLICK') {
                    const data = await fetchChartByCell(payload.key, payload.value)
                    return { data, error: null }
                }
                return prevState
            } catch (error) {
                console.error("Chart Fetch Error:", error)
                return {
                    data: prevState.data,
                    error: error instanceof Error ? error.message : '차트 조회 실패',
                }
            }
        },
        { data: [], error: null }
    )

    function handleSearchClick() {
        // Action Dispatch 함수는 내부적으로 Transition으로 감싸져 있으므로 상태 업데이트가 안전합니다.
        // dispatchGrid(condValues)
        // dispatchChart({ type: 'SEARCH', cond: condValues })

        // startTransition(() => {
        //     dispatchGrid(condValues)
        //     dispatchChart({ type: 'SEARCH', cond: condValues })
        // })

        // // 1. 그리드 데이터 페칭: 독립적인 Transition
        // startTransition(() => {
        //     dispatchGrid(condValues)
        // })

        // // 2. 차트 데이터 페칭: 독립적인 Transition
        // startTransition(() => {
        //     dispatchChart({ type: 'SEARCH', cond: condValues })
        // })

        // 1. 그리드 데이터 페칭: 즉시 실행 (첫 번째 네트워크 요청)
        startTransition(() => {
            dispatchGrid(condValues)
        })

        // 2. 차트 데이터 페칭: 다음 이벤트 루프에서 실행 (두 번째 네트워크 요청으로 분리됨)
        setTimeout(() => {
            startTransition(() => {
                dispatchChart({ type: 'SEARCH', cond: condValues })
            })
        }, 0) // 0ms 지연이지만, Next.js의 배칭망을 벗어나게 해줍니다.
    }

    /* ── 5. 셀 더블클릭 & 탭 제어 ── */
    const router = useRouter()
    const searchParams = useSearchParams()
    const activeTab = Number(searchParams.get('tab') ?? 0)

    const setActiveTab = useCallback((idx: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('tab', String(idx))
        router.push(`?${params.toString()}`, { scroll: false })
    }, [router, searchParams])

    const handleCellDoubleClick = useCallback((value: unknown, column: GridColumn) => {
        // ✅ 차트 데이터 갱신 Action 트리거도 Transition으로 감싸기
        startTransition(() => {
            dispatchChart({ type: 'CELL_DOUBLE_CLICK', key: column.key, value })
        })

        // 탭 전환은 Transition 밖에서 즉시 실행 (UI 반응성을 위해)
        setActiveTab(1)
    }, [setActiveTab])

    /* ────────────────────────────────────────────────────────────
     * 렌더
     * ────────────────────────────────────────────────────────────*/
    return (
        <main className="min-h-screen bg-bg-primary px-4 py-6">
            <div className="mx-auto max-w-[1400px]">
                <h1 className="mb-6 text-2xl font-bold text-text-primary">
                    NewSearch (React 19 Server Action 표준화)
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
                            dataSource={i1DataSource}
                            helperText={`${I1_STATIC_OPTIONS.length}건 (정적)`}
                        />
                        <Input
                            id='i2'
                            type="select"
                            label="Input 2 (i1 cascade)"
                            value={condValues.i2}
                            onChange={handleSelectChange}
                            dataSource={i2DataSource}
                            helperText="드롭다운 열면 조회 (Input 1 기반)"
                        />
                        <Input
                            id='i3'
                            type="select"
                            label="Input 3 (i1+i2 cascade)"
                            value={condValues.i3}
                            onChange={handleSelectChange}
                            dataSource={i3DataSource}
                            helperText="드롭다운 열면 조회 (Input 1+2 기반)"
                        />
                        <Input
                            id='i4'
                            type="select"
                            label="Input 4 (string[] fetcher)"
                            value={condValues.i4}
                            onChange={handleSelectChange}
                            dataSource={i4DataSource}
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
                            dataSource={i6Options}
                            helperText={loadingI6 ? '데이터 로딩 중...' : `${i6Options.length}건`}
                        />
                    </SearchPanel>

                    {/* 우측 콘텐츠: Tab(Grid / Chart) */}
                    <div className="flex-1 min-w-0">
                        <Panel variant="outlined">
                            <Tab activeIndex={activeTab} onChangeIndex={setActiveTab}>
                                <TabSub label="검색 결과 (Grid)">
                                    {/*
                                     * [변경] CompGrid 내부에 ErrorBoundary가 자동 래핑되어
                                     * 더 이상 사용처에서 ErrorBoundary로 감쌀 필요가 없다.
                                     * 렌더 에러가 발생하면 그리드 영역만 자동으로 fallback UI로 대체된다.
                                     *
                                     * --- 이전 구현 (참고용 보존) ---
                                     * <ErrorBoundary
                                     *     fallback={
                                     *         <div className="flex items-center justify-center h-[500px] text-sm text-text-muted border border-border rounded">
                                     *             그리드를 렌더링하는 중 오류가 발생했습니다.
                                     *         </div>
                                     *     }
                                     * >
                                     *     ...CompGrid...
                                     * </ErrorBoundary>
                                     */}
                                    {gridState.error && (
                                        <p className="mb-2 text-xs text-error">⚠️ {gridState.error}</p>
                                    )}
                                    <CompGrid
                                        columns={COLUMNS}
                                        data={gridState.data as unknown as Record<string, unknown>[]}
                                        loading={isGridPending}
                                        onCellDoubleClick={handleCellDoubleClick}
                                        height="500px"
                                    />
                                    <p className="mt-2 text-xs text-text-muted">
                                        💡 셀을 더블클릭하면 해당 값 기반의 차트가 두번째 탭에 표시됩니다.
                                    </p>
                                </TabSub>
                                <TabSub label="차트 (Chart)">
                                    <ErrorBoundary
                                        fallback={
                                            <div className="flex items-center justify-center h-[320px] text-sm text-text-muted border border-border rounded">
                                                차트를 렌더링하는 중 오류가 발생했습니다.
                                            </div>
                                        }
                                    >
                                        {chartState.error && (
                                            <p className="mb-2 text-xs text-error">⚠️ {chartState.error}</p>
                                        )}
                                        <CompChart
                                            data={chartState.data}
                                            loading={isChartPending}
                                            title="상태별 분포"
                                            height="320px"
                                        />
                                    </ErrorBoundary>
                                </TabSub>
                            </Tab>
                        </Panel>
                    </div>
                </div>

                <div className="mt-6">
                    <RouteInfo
                        pattern="Unified DataSource (useMemo) + Server Action (useActionState)"
                        syntax="app/new-search/page.tsx"
                        description="불필요한 useRef를 제거하고 데이터 흐름을 단방향(useMemo)으로 개선했습니다. 데이터 패칭은 React 19의 useActionState를 적용하여 pending 상태와 Race Condition 관리를 프레임워크에 완전히 위임한 클린 아키텍처 예시입니다."
                        docsUrl="https://react.dev/reference/react/useActionState"
                    />
                </div>
            </div>
        </main>
    )
}