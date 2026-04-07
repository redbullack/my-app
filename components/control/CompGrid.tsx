/**
 * @component CompGrid
 * @description
 * 가상화된 데이터 그리드 컴포넌트 (Compound Component 패턴).
 * `loading` prop이 true이면 내장 스켈레톤을 자동 렌더링하므로
 * <Suspense fallback={}> 래핑 없이 독립적으로 로딩 상태를 처리한다.
 *
 * 사용 예:
 *   <CompGrid columns={cols} data={rows} loading={isPending} />
 *   <CompGrid.Skeleton columns={cols} />  ← 단독 스켈레톤 사용도 가능
 */
'use client'

import { useRef, type ReactNode, type ErrorInfo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn } from '@/lib/utils'
import type { GridColumn } from '@/types'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'

/* ── Skeleton 서브 컴포넌트 ── */

interface CompGridSkeletonProps {
  columns: GridColumn[]
  height?: string
  rowCount?: number
  className?: string
}

function CompGridSkeleton({
  columns,
  height = '600px',
  rowCount = 15,
  className,
}: CompGridSkeletonProps) {
  return (
    <div className={cn('rounded-xl border border-border overflow-hidden', className)}>
      {/* 헤더 스켈레톤 */}
      <div className="flex bg-bg-tertiary border-b border-border">
        {columns.map(col => (
          <div
            key={col.key}
            className="px-3 py-2 shrink-0"
            style={{ width: col.width }}
          >
            <div className="h-3 w-3/4 rounded bg-bg-tertiary animate-pulse" />
          </div>
        ))}
      </div>

      {/* 행 스켈레톤 */}
      <div style={{ height }} className="overflow-hidden bg-bg-primary">
        {Array.from({ length: rowCount }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'flex items-center border-b border-border',
              i % 2 === 0 ? 'bg-bg-primary' : 'bg-bg-secondary',
            )}
            style={{ height: '36px' }}
          >
            {columns.map(col => (
              <div
                key={col.key}
                className="px-3 shrink-0"
                style={{ width: col.width }}
              >
                <div
                  className="h-2.5 rounded bg-bg-tertiary animate-pulse"
                  style={{ width: `${50 + Math.random() * 40}%` }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── 메인 CompGrid 컴포넌트 ── */

interface CompGridProps {
  columns: GridColumn[]
  data: Record<string, unknown>[]
  loading?: boolean
  height?: string
  rowHeight?: number
  overscan?: number
  emptyMessage?: string
  className?: string
  /** 셀 더블클릭 이벤트 (옵션). 핸들러가 있으면 셀에 cursor-pointer가 적용된다. */
  onCellDoubleClick?: (
    value: unknown,
    column: GridColumn,
    row: Record<string, unknown>,
    rowIndex: number,
  ) => void
  /** 렌더링 에러 발생 시 표시할 커스텀 fallback (옵션). 미지정 시 기본 fallback 사용. */
  errorFallback?: ReactNode
  /** 렌더링 에러 발생 시 호출되는 콜백 (옵션). 로깅/모니터링용. */
  onError?: (error: Error, info: ErrorInfo) => void
}

/* ── 기본 에러 fallback ── */
function DefaultGridErrorFallback({ height = '600px' }: { height?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border border-error/40 bg-error/5 text-text-muted"
      style={{ height }}
    >
      <p className="text-sm font-medium text-error">⚠️ 그리드를 렌더링하는 중 오류가 발생했습니다.</p>
      <p className="mt-1 text-xs">데이터 형식을 확인하거나 페이지를 새로고침 해주세요.</p>
    </div>
  )
}

function CompGridInner({
  columns,
  data,
  loading = false,
  height = '600px',
  rowHeight = 36,
  overscan = 20,
  emptyMessage = '조건을 선택하고 Search 버튼을 클릭하세요',
  className,
  onCellDoubleClick,
}: CompGridProps) {
  // throw new Error('CLIENT: CompGridInner - 수동 랜더링 에러 입니다.')
  const scrollRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan,
  })

  /* loading 상태일 때 내장 스켈레톤 자동 렌더링 */
  if (loading) {
    return <CompGridSkeleton columns={columns} height={height} className={className} />
  }

  /* 데이터 없음 */
  if (data.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-xl border border-border bg-bg-secondary',
          className,
        )}
        style={{ height }}
      >
        <p className="text-sm text-text-muted">{emptyMessage}</p>
      </div>
    )
  }

  /* 데이터 그리드 */
  return (
    <div className={cn('rounded-xl border border-border overflow-hidden', className)}>
      {/* 헤더 */}
      <div className="flex bg-bg-tertiary border-b border-border">
        {columns.map(col => (
          <div
            key={col.key}
            className={cn(
              'px-3 py-2 text-xs font-semibold text-text-secondary shrink-0',
              col.align === 'right' && 'text-right',
              col.align === 'center' && 'text-center',
            )}
            style={{ width: col.width }}
          >
            {col.label}
          </div>
        ))}
      </div>

      {/* 건수 표시 */}
      <div className="px-3 py-1.5 text-xs text-text-secondary border-b border-border bg-bg-primary">
        총 <strong className="text-text-primary">{data.length.toLocaleString()}</strong>건
      </div>

      {/* 가상화된 행 */}
      <div
        ref={scrollRef}
        className="overflow-auto bg-bg-primary"
        style={{ height }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            position: 'relative',
            width: '100%',
          }}
        >
          {rowVirtualizer.getVirtualItems().map(virtualRow => {
            const row = data[virtualRow.index]
            const isEven = virtualRow.index % 2 === 0
            return (
              <div
                key={virtualRow.key}
                className={cn(
                  'flex items-center border-b border-border',
                  isEven ? 'bg-bg-primary' : 'bg-bg-secondary',
                )}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {columns.map(col => {
                  const value = row[col.key]
                  return (
                    <div
                      key={col.key}
                      className={cn(
                        'px-3 text-xs text-text-primary shrink-0 truncate',
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                        onCellDoubleClick && 'cursor-pointer select-none',
                      )}
                      style={{ width: col.width }}
                      onDoubleClick={
                        onCellDoubleClick
                          ? () => onCellDoubleClick(value, col, row, virtualRow.index)
                          : undefined
                      }
                    >
                      {col.render ? col.render(value, row) : String(value ?? '')}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ── 에러 격리 래퍼 ──
 * CompGrid를 사용하는 모든 화면이 자동으로 에러 격리 혜택을 받도록
 * 외부 노출용 컴포넌트는 ErrorBoundary로 감싼 래퍼다. 사용처는
 * <CompGrid ... /> 만 쓰면 되고, 렌더 에러가 나면 그리드 영역만
 * fallback UI로 대체된다.
 */
function CompGrid(props: CompGridProps) {
  const { errorFallback, onError, ...rest } = props
  return (
    <ErrorBoundary
      fallback={errorFallback ?? <DefaultGridErrorFallback height={props.height} />}
      onError={onError}
    >
      <CompGridInner {...rest} />
    </ErrorBoundary>
  )
}

/* Compound Component: 정적 속성으로 Skeleton 노출 */
CompGrid.Skeleton = CompGridSkeleton

export default CompGrid
