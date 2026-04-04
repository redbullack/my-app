/**
 * @route POST /api/comp-search/chart
 * @description
 * 차트 집계 데이터를 조회하는 Route Handler.
 * Server Action 직렬화 제약을 우회하여 Grid와 독립적으로 병렬 실행된다.
 */

import { NextResponse } from 'next/server'
import { fetchChartData } from '@/lib/search-queries'

export async function POST(request: Request) {
  const { selectedA, selectedB, selectedC } = await request.json()
  const data = await fetchChartData(selectedA, selectedB, selectedC)
  return NextResponse.json(data)
}
