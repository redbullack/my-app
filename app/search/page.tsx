/**
 * @route /search
 * @pattern Server Action + Client Component + Virtualization + Cascading Select
 * @description
 * SearchPanel과 가상화된 메인 그리드를 활용한 대량 데이터 검색 페이지.
 * - 좌측 SearchPanel에 ITEM-A, ITEM-B, ITEM-C 멀티셀렉트 (각 수천 건, 가상화 적용)
 * - 캐스케이딩 의존성: A(고정) → B(selectedA 기반) → C(selectedA+selectedB 기반)
 * - 단일 handleItemChange 핸들러에서 A/B/C를 분기 처리
 * - DataSource는 통합 fetchItemDataSource Server Action으로 조회
 * - Search 버튼 클릭 시 Server Action으로 최대 수만 건의 결과를 조회
 * - 메인 그리드에 @tanstack/react-virtual 가상화 적용
 */
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Input, SearchPanel } from '@/components/control'
import RouteInfo from '@/components/shared/RouteInfo'
import {
  fetchItemDataSource,
  fetchSearchResults,
} from '@/actions/search'
import type { ItemType } from '@/actions/search'
import type { SelectOption } from '@/types'
import type { SearchResultRow } from '@/actions/search'

type CondKey = 'itemA' | 'itemB' | 'itemC'
type CondDataSource = Record<CondKey, SelectOption[]>
type CondValues = Record<CondKey, string[]>

const EMPTY_DS: CondDataSource = { itemA: [], itemB: [], itemC: [] }
const EMPTY_VALUES: CondValues = { itemA: [], itemB: [], itemC: [] }

const COLUMNS: { key: keyof SearchResultRow; label: string; width: string }[] = [
  { key: 'id', label: 'ID', width: '80px' },
  { key: 'itemA', label: 'ITEM-A', width: '120px' },
  { key: 'itemB', label: 'ITEM-B', width: '120px' },
  { key: 'itemC', label: 'ITEM-C', width: '120px' },
  { key: 'productName', label: '상품명', width: '180px' },
  { key: 'price', label: '가격', width: '120px' },
  { key: 'stock', label: '재고', width: '80px' },
  { key: 'status', label: '상태', width: '100px' },
  { key: 'createdAt', label: '등록일', width: '120px' },
]

export default function SearchPage() {
  /* ── DataSource 상태 (통합) ── */
  const [condDataSource, setCondDataSource] = useState<CondDataSource>({ ...EMPTY_DS })

  /* ── 선택값 상태 (통합) ── */
  const [condValues, setCondValues] = useState<CondValues>({ ...EMPTY_VALUES })

  /* ── 로딩 상태 ── */
  const [loadingDS, setLoadingDS] = useState<Record<CondKey, boolean>>({
    itemA: true, itemB: true, itemC: false,
  })
  const [results, setResults] = useState<SearchResultRow[]>([])
  const [isLoading, setIsLoading] = useState(false)

  /* ── Race condition 방지용 fetch ID ── */
  const fetchIdRef = useRef<{ C: number }>({ C: 0 })

  const gridScrollRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: results.length,
    getScrollElement: () => gridScrollRef.current,
    estimateSize: () => 36,
    overscan: 20,
  })

  /* ── 마운트 시 ITEM-A, ITEM-B 로드 (고정 조건) ── */
  useEffect(() => {
    async function loadInitialDS() {
      const [a, b] = await Promise.all([
        fetchItemDataSource('A'),
        fetchItemDataSource('B'),
      ])
      setCondDataSource(prev => ({ ...prev, itemA: a, itemB: b }))
      setLoadingDS(prev => ({ ...prev, itemA: false, itemB: false }))
    }
    loadInitialDS()
  }, [])

  /**
   * 단일 캐스케이딩 핸들러.
   * A/B/C 변경 시 하위 선택값 초기화 및 하위 DataSource 재조회를 분기 처리한다.
   */
  const handleItemChange = useCallback(async (type: ItemType, newSelected: string[]) => {
    switch (type) {
      case 'A': {
        setCondValues(prev => ({ ...prev, itemA: newSelected, itemB: [], itemC: [] }))
        setCondDataSource(prev => ({ ...prev, itemC: [] }))
        break
      }
      case 'B': {
        setCondValues(prev => ({ ...prev, itemB: newSelected, itemC: [] }))

        if (newSelected.length > 0) {
          const id = ++fetchIdRef.current.C
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
        setCondValues(prev => ({ ...prev, itemC: newSelected }))
        break
      }
    }
  }, [condValues.itemA])

  async function handleSearchClick() {
    setIsLoading(true)
    try {
      const data = await fetchSearchResults(condValues.itemA, condValues.itemB, condValues.itemC)
      setResults(data)
    } finally {
      setIsLoading(false)
    }
  }

  function formatPrice(n: number) {
    return n.toLocaleString('ko-KR') + '원'
  }

  return (
    <main className="min-h-screen bg-bg-primary px-4 py-6">
      <div className="mx-auto max-w-[1400px]">
        <h1 className="mb-6 text-2xl font-bold text-text-primary">Search (Virtualization Demo)</h1>

        <div className="flex gap-6 items-start">
          {/* 좌측 SearchPanel */}
          <SearchPanel
            label="Search Panel"
            onSearchClick={handleSearchClick}
            isLoading={isLoading}
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
              dataSource={condDataSource.itemB}
              helperText={loadingDS.itemB ? '데이터 로딩 중...' : `${condDataSource.itemB.length}건`}
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

          {/* 메인 그리드 영역 */}
          <div className="flex-1 flex flex-col gap-3 min-w-0">
            {results.length > 0 && (
              <p className="text-sm text-text-secondary">
                총 <strong className="text-text-primary">{results.length.toLocaleString()}</strong>건 조회됨
              </p>
            )}

            {results.length > 0 ? (
              <div className="rounded-xl border border-border overflow-hidden">
                {/* 헤더 */}
                <div className="flex bg-bg-tertiary border-b border-border">
                  {COLUMNS.map(col => (
                    <div
                      key={col.key}
                      className="px-3 py-2 text-xs font-semibold text-text-secondary shrink-0"
                      style={{ width: col.width }}
                    >
                      {col.label}
                    </div>
                  ))}
                </div>

                {/* 가상화된 행 */}
                <div
                  ref={gridScrollRef}
                  className="overflow-auto bg-bg-primary"
                  style={{ height: '600px' }}
                >
                  <div
                    style={{
                      height: `${rowVirtualizer.getTotalSize()}px`,
                      position: 'relative',
                      width: '100%',
                    }}
                  >
                    {rowVirtualizer.getVirtualItems().map(virtualRow => {
                      const row = results[virtualRow.index]
                      const isEven = virtualRow.index % 2 === 0
                      return (
                        <div
                          key={virtualRow.key}
                          className={`flex items-center border-b border-border ${isEven ? 'bg-bg-primary' : 'bg-bg-secondary'}`}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          <div className="px-3 text-xs text-text-muted shrink-0" style={{ width: '80px' }}>{row.id}</div>
                          <div className="px-3 text-xs text-text-primary shrink-0 truncate" style={{ width: '120px' }}>{row.itemA}</div>
                          <div className="px-3 text-xs text-text-primary shrink-0 truncate" style={{ width: '120px' }}>{row.itemB}</div>
                          <div className="px-3 text-xs text-text-primary shrink-0 truncate" style={{ width: '120px' }}>{row.itemC}</div>
                          <div className="px-3 text-xs text-text-primary shrink-0 truncate" style={{ width: '180px' }}>{row.productName}</div>
                          <div className="px-3 text-xs text-text-primary shrink-0 text-right" style={{ width: '120px' }}>{formatPrice(row.price)}</div>
                          <div className="px-3 text-xs text-text-primary shrink-0 text-right" style={{ width: '80px' }}>{row.stock}</div>
                          <div className="px-3 text-xs shrink-0" style={{ width: '100px' }}>
                            <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${row.status === '판매중' ? 'bg-success/15 text-success' :
                              row.status === '품절' ? 'bg-error/15 text-error' :
                                row.status === '할인중' ? 'bg-info/15 text-info' :
                                  row.status === '단종' ? 'bg-text-muted/15 text-text-muted' :
                                    'bg-warning/15 text-warning'
                              }`}>
                              {row.status}
                            </span>
                          </div>
                          <div className="px-3 text-xs text-text-muted shrink-0" style={{ width: '120px' }}>{row.createdAt}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-xl border border-border bg-bg-secondary h-[600px]">
                <p className="text-sm text-text-muted">
                  {isLoading ? '조회 중...' : '좌측 패널에서 조건을 선택하고 Search 버튼을 클릭하세요'}
                </p>
              </div>
            )}

            <RouteInfo
              pattern="Server Action + Virtualization + Cascading Select"
              syntax="app/search/page.tsx"
              description="SearchPanel로 캐스케이딩 검색 조건(A→B→C)을 설정하고, 단일 fetchItemDataSource Server Action으로 조건 기반 데이터소스를 조회한 뒤, @tanstack/react-virtual 가상화를 적용하여 수만 건의 데이터를 부드럽게 스크롤하는 패턴입니다."
              docsUrl="https://tanstack.com/virtual/latest"
            />
          </div>
        </div>
      </div>
    </main>
  )
}
