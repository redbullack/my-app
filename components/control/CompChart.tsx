/**
 * @component CompChart
 * @description
 * 수평 막대 차트 컴포넌트 (Compound Component 패턴).
 * `loading` prop이 true이면 내장 스켈레톤을 자동 렌더링하므로
 * <Suspense fallback={}> 래핑 없이 독립적으로 로딩 상태를 처리한다.
 * 외부 차트 라이브러리 없이 순수 CSS/HTML로 구현.
 *
 * 사용 예:
 *   <CompChart data={chartData} loading={isPending} title="상태별 분포" />
 *   <CompChart.Skeleton />  ← 단독 스켈레톤 사용도 가능
 */
'use client'

import { cn } from '@/lib/utils'
import type { ChartDataRow } from '@/actions/search'

/* ── 색상 → Tailwind 클래스 매핑 ── */
const BAR_COLORS: Record<string, string> = {
  success: 'bg-success',
  error: 'bg-error',
  warning: 'bg-warning',
  info: 'bg-info',
  'text-muted': 'bg-text-muted',
  accent: 'bg-accent',
}

/* ── Skeleton 서브 컴포넌트 ── */

interface CompChartSkeletonProps {
  title?: string
  height?: string
  barCount?: number
  className?: string
}

function CompChartSkeleton({
  title,
  height = '300px',
  barCount = 5,
  className,
}: CompChartSkeletonProps) {
  const widths = [85, 60, 45, 70, 30]
  return (
    <div
      className={cn('rounded-xl border border-border bg-bg-primary p-5', className)}
      style={{ minHeight: height }}
    >
      {/* 제목 스켈레톤 */}
      {title ? (
        <h3 className="mb-4 text-sm font-semibold text-text-primary">{title}</h3>
      ) : (
        <div className="mb-4 h-4 w-40 rounded bg-bg-tertiary animate-pulse" />
      )}

      <div className="flex flex-col gap-4">
        {Array.from({ length: barCount }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            {/* 라벨 스켈레톤 */}
            <div className="w-20 shrink-0">
              <div className="h-3 w-full rounded bg-bg-tertiary animate-pulse" />
            </div>
            {/* 막대 스켈레톤 */}
            <div className="flex-1">
              <div
                className="h-7 rounded bg-bg-tertiary animate-pulse"
                style={{ width: `${widths[i % widths.length]}%` }}
              />
            </div>
            {/* 값 스켈레톤 */}
            <div className="w-16 shrink-0">
              <div className="h-3 w-full rounded bg-bg-tertiary animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── 메인 CompChart 컴포넌트 ── */

interface CompChartProps {
  data: ChartDataRow[]
  loading?: boolean
  title?: string
  height?: string
  className?: string
}

function CompChart({
  data,
  loading = false,
  title,
  height = '300px',
  className,
}: CompChartProps) {
  /* loading 상태일 때 내장 스켈레톤 자동 렌더링 */
  if (loading) {
    return <CompChartSkeleton title={title} height={height} className={className} />
  }

  /* 데이터 없음 */
  if (data.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-xl border border-border bg-bg-secondary',
          className,
        )}
        style={{ minHeight: height }}
      >
        <p className="text-sm text-text-muted">차트 데이터가 없습니다</p>
      </div>
    )
  }

  const maxValue = Math.max(...data.map(d => d.value))

  return (
    <div
      className={cn('rounded-xl border border-border bg-bg-primary p-5', className)}
      style={{ minHeight: height }}
    >
      {title && (
        <h3 className="mb-4 text-sm font-semibold text-text-primary">{title}</h3>
      )}

      <div className="flex flex-col gap-4">
        {data.map(item => {
          const pct = maxValue > 0 ? (item.value / maxValue) * 100 : 0
          const barClass = BAR_COLORS[item.color] || 'bg-accent'

          return (
            <div key={item.label} className="flex items-center gap-3">
              {/* 라벨 */}
              <span className="w-20 shrink-0 text-xs font-medium text-text-secondary text-right">
                {item.label}
              </span>

              {/* 막대 */}
              <div className="flex-1 bg-bg-secondary rounded overflow-hidden h-7">
                <div
                  className={cn(barClass, 'h-full rounded transition-all duration-500 ease-out')}
                  style={{ width: `${pct}%` }}
                />
              </div>

              {/* 값 */}
              <span className="w-20 shrink-0 text-xs font-medium text-text-primary text-right tabular-nums">
                {item.value.toLocaleString('ko-KR')}건
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* Compound Component: 정적 속성으로 Skeleton 노출 */
CompChart.Skeleton = CompChartSkeleton

export default CompChart
