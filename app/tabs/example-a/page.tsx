/**
 * @route /tabs/example-a
 * @pattern Static Route + Client State Tabs
 * @description
 * 단일 페이지에서 Tab/TabSub 컴포넌트를 사용하여 탭 전환을 구현한다.
 * 매출 그리드 탭에서 행을 클릭하면 selectedMonth 상태가 변경되고,
 * 차트 탭에서 해당 월의 바가 하이라이트된다 (크로스탭 데이터 통신).
 * 탭 전환 시 내부 상태가 리셋되지 않는다.
 */
'use client'

import { useState } from 'react'
import { Tab, TabSub, Panel, Badge } from '@/components/control'
import RouteInfo from '@/components/shared/RouteInfo'

interface SalesData {
  month: string
  amount: number
  growth: number
}

const SALES_DATA: SalesData[] = [
  { month: '1월', amount: 4200, growth: 0 },
  { month: '2월', amount: 3800, growth: -9.5 },
  { month: '3월', amount: 5100, growth: 34.2 },
  { month: '4월', amount: 4700, growth: -7.8 },
  { month: '5월', amount: 6300, growth: 34.0 },
  { month: '6월', amount: 5900, growth: -6.3 },
]

const MAX_AMOUNT = Math.max(...SALES_DATA.map((d) => d.amount))
const CHART_HEIGHT = 200
const BAR_WIDTH = 50
const BAR_GAP = 20
const CHART_WIDTH = SALES_DATA.length * (BAR_WIDTH + BAR_GAP)

export default function ExampleAPage() {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [sortAsc, setSortAsc] = useState(true)

  const sortedData = [...SALES_DATA].sort((a, b) =>
    sortAsc ? a.amount - b.amount : b.amount - a.amount,
  )

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Example A — 클라이언트 상태</h1>
        <p className="mt-2 text-text-secondary">
          그리드 행을 클릭하면 차트 탭에서 해당 월이 하이라이트됩니다. 탭을 전환해도 선택 상태가 유지됩니다.
        </p>
        {selectedMonth && (
          <p className="mt-1 text-sm text-accent">
            선택된 월: <span className="font-semibold">{selectedMonth}</span>
          </p>
        )}
      </div>

      <Panel variant="outlined">
        <Tab className="rounded-xl border border-border bg-bg-secondary p-4">
          {/* 매출 그리드 탭 */}
          <TabSub label="매출 그리드" className="bg-bg-primary rounded-lg p-4 border border-border">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-text-secondary">월별 매출 데이터</h3>
                <button
                  type="button"
                  onClick={() => setSortAsc(!sortAsc)}
                  className="text-xs text-accent hover:text-accent-hover transition-colors"
                >
                  금액 {sortAsc ? '오름차순 ↑' : '내림차순 ↓'}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-text-muted">
                      <th className="pb-2 pr-4 font-medium">월</th>
                      <th className="pb-2 pr-4 font-medium">매출 (만원)</th>
                      <th className="pb-2 font-medium">성장률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedData.map((row) => (
                      <tr
                        key={row.month}
                        onClick={() => setSelectedMonth(row.month)}
                        className={`cursor-pointer border-b border-border transition-colors ${selectedMonth === row.month
                          ? 'bg-accent/10'
                          : 'hover:bg-bg-tertiary'
                          }`}
                      >
                        <td className="py-2.5 pr-4 text-text-primary font-medium">
                          {row.month}
                        </td>
                        <td className="py-2.5 pr-4 text-text-primary">
                          {row.amount.toLocaleString()}
                        </td>
                        <td className="py-2.5">
                          <Badge variant={row.growth >= 0 ? 'success' : 'error'}>
                            {row.growth >= 0 ? '+' : ''}{row.growth}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabSub>

          {/* 매출 차트 탭 */}
          <TabSub label="매출 차트" className="bg-bg-tertiary rounded-2xl p-6 shadow-inner">
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-text-secondary">
                월별 매출 바 차트
                {selectedMonth && (
                  <span className="ml-2 text-accent">({selectedMonth} 선택됨)</span>
                )}
              </h3>
              <div className="overflow-x-auto">
                <svg
                  width={CHART_WIDTH + 40}
                  height={CHART_HEIGHT + 40}
                  className="mx-auto"
                >
                  {SALES_DATA.map((d, i) => {
                    const barHeight = (d.amount / MAX_AMOUNT) * CHART_HEIGHT
                    const x = i * (BAR_WIDTH + BAR_GAP) + 20
                    const y = CHART_HEIGHT - barHeight + 10
                    const isSelected = selectedMonth === d.month

                    return (
                      <g key={d.month}>
                        <rect
                          x={x}
                          y={y}
                          width={BAR_WIDTH}
                          height={barHeight}
                          rx={4}
                          className={
                            isSelected
                              ? 'fill-accent'
                              : 'fill-bg-tertiary'
                          }
                        />
                        {/* 금액 라벨 */}
                        <text
                          x={x + BAR_WIDTH / 2}
                          y={y - 6}
                          textAnchor="middle"
                          className={`text-xs ${isSelected ? 'fill-accent' : 'fill-text-muted'
                            }`}
                        >
                          {d.amount}
                        </text>
                        {/* 월 라벨 */}
                        <text
                          x={x + BAR_WIDTH / 2}
                          y={CHART_HEIGHT + 28}
                          textAnchor="middle"
                          className={`text-xs ${isSelected
                            ? 'fill-accent font-semibold'
                            : 'fill-text-secondary'
                            }`}
                        >
                          {d.month}
                        </text>
                      </g>
                    )
                  })}
                </svg>
              </div>
            </div>
          </TabSub>
        </Tab>
      </Panel>

      <RouteInfo
        pattern="Client State Tabs"
        syntax="app/tabs/example-a/page.tsx"
        description="단일 페이지에서 Tab/TabSub을 사용하고 useState로 탭 간 데이터 통신을 구현한다. 그리드에서 선택한 월이 차트에서 하이라이트된다."
      />
    </div>
  )
}
