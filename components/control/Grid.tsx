/**
 * @component Grid
 * @description
 * TUI Grid 기반의 데이터 그리드 컴포넌트.
 * - dataSource는 배열, Promise, 또는 배열을 반환하는 함수(동기/비동기 모두 허용)
 * - 비동기 dataSource일 경우 React 19 `use()` + <Suspense>로 GridSkeleton fallback 처리
 * - columns 미전달 시 dataSource의 키에서 자동 추론
 * - tui-grid의 정렬, 필터, 인라인 편집, 체크박스, 컬럼 리사이즈 등 지원
 * - gridRef를 통해 부모에서 TUI Grid 인스턴스에 직접 접근 가능
 *
 * 사용 예:
 *   <Grid dataSource={rows} />
 *   <Grid dataSource={async () => await fetchRows()} sortable />
 *   <Grid dataSource={promise} columns={cols} rowHeaders={['rowNum','checkbox']} gridRef={ref} />
 */
'use client'

import { Suspense, use, useEffect, useMemo, useRef, type ReactNode } from 'react'
import type { GridEventName, OptColumn, OptRow, OptRowHeader } from 'tui-grid/types/options'
import { cn } from '@/lib/utils'

/* ── 타입 ── */

type Row = Record<string, unknown>
type DataSource<T extends object = Row> =
  | T[]
  | Promise<T[]>
  | (() => T[] | Promise<T[]>)

interface GridColumn {
  name: string
  header?: string
  width?: number
  minWidth?: number
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  filter?: 'text' | 'number' | 'date' | 'select' | null
  editor?: 'text' | 'datePicker' | 'select' | object
  resizable?: boolean
  hidden?: boolean
  formatter?: string | ((value: { value: unknown }) => string)
}

interface DerivedColumn {
  key: string
  label: string
}

/* ── GridSkeleton ── */

interface GridSkeletonProps {
  columns?: DerivedColumn[]
  height?: string
  rowCount?: number
  className?: string
}

function GridSkeleton({
  columns,
  height = '600px',
  rowCount = 15,
  className,
}: GridSkeletonProps) {
  const cols = columns ?? Array.from({ length: 4 }, (_, i) => ({ key: `c${i}`, label: '' }))
  return (
    <div className={cn('rounded-xl border border-border overflow-hidden', className)}>
      <div className="flex bg-bg-tertiary border-b border-border">
        {cols.map(col => (
          <div key={col.key} className="px-3 py-2 shrink-0 flex-1">
            <div className="h-3 w-3/4 rounded bg-bg-tertiary animate-pulse" />
          </div>
        ))}
      </div>
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
            {cols.map(col => (
              <div key={col.key} className="px-3 shrink-0 flex-1">
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

/* ── 컬럼 자동 추론 ── */

function deriveColumns(rows: Row[]): GridColumn[] {
  if (rows.length === 0) return []
  return Object.keys(rows[0]).map(key => ({
    name: key,
    header: key,
    sortable: true,
    resizable: true,
  }))
}

/* ── 테마 적용 ── */

function applyGridTheme(TuiGrid: typeof import('tui-grid').default) {
  const styles = getComputedStyle(document.documentElement)
  const get = (v: string) => styles.getPropertyValue(v).trim()

  TuiGrid.applyTheme('default', {
    cell: {
      normal: {
        background: get('--color-bg-primary'),
        text: get('--color-text-primary'),
        border: get('--color-border'),
      },
      header: {
        background: get('--color-bg-tertiary'),
        text: get('--color-text-secondary'),
        border: get('--color-border'),
      },
      evenRow: {
        background: get('--color-bg-secondary'),
      },
      selectedHeader: {
        background: get('--color-accent'),
      },
    },
    outline: {
      border: get('--color-border'),
    },
    frozenBorder: {
      border: get('--color-border'),
    },
  })
}

/* ── 메인 Props ── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TuiGridInstance = any

interface GridProps<T extends object = Row> {
  dataSource: DataSource<T>
  columns?: GridColumn[]
  height?: string
  rowHeight?: number
  emptyMessage?: string
  className?: string
  rowHeaders?: OptRowHeader[]
  sortable?: boolean
  columnResizable?: boolean
  frozenColumnCount?: number
  editable?: boolean
  gridRef?: React.RefObject<TuiGridInstance | null>
  onCellDoubleClick?: (ev: { rowKey: number | string | null; columnName: string | null; value: unknown }) => void
  onCheck?: (ev: { rowKey: number | string | null }) => void
  onUncheck?: (ev: { rowKey: number | string | null }) => void
  onAfterChange?: (ev: { changes: Array<{ rowKey: number | string; columnName: string; value: unknown }> }) => void
}

interface GridContentProps extends Omit<GridProps, 'dataSource'> {
  resource: Row[] | Promise<Row[]>
}

/* ── GridContent: TUI Grid 인스턴스 관리 ── */

function GridContent({
  resource,
  columns: columnsProp,
  height = '600px',
  rowHeight = 40,
  emptyMessage = '조건을 선택하고 Search 버튼을 클릭하세요',
  className,
  rowHeaders,
  sortable = false,
  columnResizable = true,
  frozenColumnCount,
  editable = false,
  gridRef,
  onCellDoubleClick,
  onCheck,
  onUncheck,
  onAfterChange,
}: GridContentProps) {
  const data: Row[] = resource instanceof Promise ? use(resource) : resource

  const resolvedColumns = useMemo(
    () => columnsProp ?? deriveColumns(data),
    [columnsProp, data],
  )

  // sortable prop을 개별 컬럼에 반영
  const finalColumns = useMemo(() => {
    if (!sortable) return resolvedColumns
    return resolvedColumns.map(col => ({
      ...col,
      sortable: col.sortable !== false,
    }))
  }, [resolvedColumns, sortable])

  const containerRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<TuiGridInstance>(null)
  const mountedRef = useRef(false)

  // TUI Grid 인스턴스 생성 (mount)
  useEffect(() => {
    let destroyed = false

    ;(async () => {
      const TuiGrid = (await import('tui-grid')).default
      // tui-grid CSS는 IE 핵(*property) 때문에 Turbopack 파서 에러 발생
      // 번들러 대신 public/tui-grid.css를 <link> 태그로 런타임 로드
      if (!document.querySelector('link[data-tui-grid-css]')) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.setAttribute('data-tui-grid-css', '')
        link.href = '/tui-grid.css'
        document.head.appendChild(link)
      }

      if (destroyed || !containerRef.current) return

      applyGridTheme(TuiGrid)

      const instance = new TuiGrid({
        el: containerRef.current,
        data: data as unknown as OptRow[],
        columns: finalColumns as unknown as OptColumn[],
        rowHeight,
        bodyHeight: parseInt(height) || 600,
        rowHeaders,
        columnOptions: {
          resizable: columnResizable,
          frozenCount: frozenColumnCount,
        },
      })

      // 빈 데이터 메시지 설정
      if (data.length === 0) {
        // TUI Grid는 빈 상태일 때 자체적으로 "No data." 를 보여줌
        // 커스텀 메시지는 별도 오버레이로 처리 가능하지만, 기본 동작 사용
      }

      // 이벤트 바인딩 — TuiGridEvent 타입이 런타임 필드를 노출하지 않으므로 any 캐스팅
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const on = (name: GridEventName, fn: (ev: any) => void) => instance.on(name, fn as never)

      if (onCellDoubleClick) {
        on('dblclick', (ev) => {
          const { rowKey, columnName } = ev
          if (rowKey == null || !columnName) return
          const value = instance.getValue(rowKey, columnName)
          onCellDoubleClick({ rowKey, columnName, value })
        })
      }
      if (onCheck) {
        on('check', (ev) => onCheck({ rowKey: ev.rowKey ?? null }))
      }
      if (onUncheck) {
        on('uncheck', (ev) => onUncheck({ rowKey: ev.rowKey ?? null }))
      }
      if (onAfterChange) {
        on('afterChange', (ev) => {
          onAfterChange({ changes: ev.changes ?? [] })
        })
      }

      instanceRef.current = instance
      if (gridRef) gridRef.current = instance
      mountedRef.current = true
    })()

    return () => {
      destroyed = true
      if (instanceRef.current) {
        instanceRef.current.destroy()
        instanceRef.current = null
        if (gridRef) gridRef.current = null
        mountedRef.current = false
      }
    }
    // mount/unmount 시에만 실행 — data/columns 변경은 별도 effect에서 처리
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 데이터 변경 시 resetData
  useEffect(() => {
    if (!mountedRef.current || !instanceRef.current) return
    instanceRef.current.resetData(data as object[])
  }, [data])

  // 컬럼 변경 시 setColumns
  useEffect(() => {
    if (!mountedRef.current || !instanceRef.current) return
    instanceRef.current.setColumns(finalColumns as object[])
  }, [finalColumns])

  return (
    <div className={cn('rounded-xl border border-border overflow-hidden', className)}>
      {/* 건수 표시 */}
      <div className="px-3 py-1.5 text-xs text-text-secondary border-b border-border bg-bg-primary">
        총 <strong className="text-text-primary">{data.length.toLocaleString()}</strong>건
      </div>
      {/* TUI Grid 마운트 포인트 */}
      <div ref={containerRef} />
    </div>
  )
}

/* ── Grid: Suspense 래퍼 ── */

function Grid<T extends object = Row>(props: GridProps<T>) {
  const { dataSource, height, className } = props

  const resource = useMemo(() => {
    const raw = typeof dataSource === 'function' ? dataSource() : dataSource
    return raw as Row[] | Promise<Row[]>
  }, [dataSource])

  const fallback: ReactNode = <GridSkeleton height={height} className={className} />

  return (
    <Suspense fallback={fallback}>
      <GridContent {...props} resource={resource} />
    </Suspense>
  )
}

Grid.Skeleton = GridSkeleton

export default Grid
export type { GridColumn, GridProps }
