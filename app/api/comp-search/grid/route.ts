/**
 * @route POST /api/comp-search/grid
 * @description
 * 검색 결과 Grid 데이터를 조회하는 Route Handler.
 * Server Action 직렬화 제약을 우회하여 Chart와 독립적으로 병렬 실행된다.
 */

import { NextResponse } from 'next/server'
import { fetchSearchResults } from '@/lib/search-queries'

export async function POST(request: Request) {
  const { selectedA, selectedB, selectedC } = await request.json()
  const data = await fetchSearchResults(selectedA, selectedB, selectedC)
  return NextResponse.json(data)
}
