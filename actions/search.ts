'use server'

/**
 * @description
 * 검색 페이지용 Server Actions.
 * 단일 fetchItemDataSource 함수로 ITEM-A/B/C 데이터소스를 조건 기반으로 조회하고,
 * 선택된 조건으로 대량의 더미 검색 결과를 반환한다.
 *
 * 캐스케이딩 의존성:
 * - ITEM-A: 고정 조건 (카테고리)
 * - ITEM-B: selectedA 기반 필터링 (지역)
 * - ITEM-C: selectedA + selectedB 기반 필터링 (브랜드)
 */

import type { SelectOption } from '@/types'

export type ItemType = 'A' | 'B' | 'C'

/**
 * 통합 데이터소스 조회 함수.
 * @param type - 아이템 타입 (A | B | C)
 * @param condition - 상위 아이템의 선택값 (A: 고정 조건, B: selectedA, C: selectedA + selectedB)
 */
export async function fetchItemDataSource(
  type: ItemType,
  condition?: string[],
): Promise<SelectOption[]> {
  switch (type) {
    case 'A':
      return generateItemA()
    case 'B':
      return generateItemB(condition)
    case 'C':
      return generateItemC(condition)
  }
}

/** ITEM-A 카테고리 데이터소스 (3,000건) */
function generateItemA(): SelectOption[] {
  const data: SelectOption[] = []
  const categories = ['전자제품', '의류', '식품', '가구', '도서', '스포츠', '뷰티', '자동차', '음악', '건강']
  for (let i = 1; i <= 3000; i++) {
    const cat = categories[i % categories.length]
    data.push({ value: `A-${String(i).padStart(4, '0')}`, label: `${cat}-${String(i).padStart(4, '0')}` })
  }
  return data
}

/** ITEM-B 지역 데이터소스 (2,000건) — selectedA 기반 필터링 시뮬레이션 */
function generateItemB(selectedA?: string[]): SelectOption[] {
  const data: SelectOption[] = []
  const regions = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주']
  const count = selectedA && selectedA.length > 0
    ? Math.min(2000, selectedA.length * 200)
    : 2000
  for (let i = 1; i <= count; i++) {
    const region = regions[i % regions.length]
    data.push({ value: `B-${String(i).padStart(4, '0')}`, label: `${region}-${String(i).padStart(4, '0')}` })
  }
  return data
}

/** ITEM-C 브랜드 데이터소스 (최대 1,500건) — selectedA + selectedB 기반 필터링 시뮬레이션 */
function generateItemC(condition?: string[]): SelectOption[] {
  const data: SelectOption[] = []
  const brands = ['삼성', 'LG', '현대', '기아', 'SK', '롯데', 'CJ', '한화', 'GS', '포스코', '네이버', '카카오']
  const count = condition && condition.length > 0
    ? Math.min(1500, condition.length * 100)
    : 1500
  for (let i = 1; i <= count; i++) {
    const brand = brands[i % brands.length]
    data.push({ value: `C-${String(i).padStart(4, '0')}`, label: `${brand}-${String(i).padStart(4, '0')}` })
  }
  return data
}

export interface SearchResultRow {
  id: number
  itemA: string
  itemB: string
  itemC: string
  productName: string
  price: number
  stock: number
  status: string
  createdAt: string
}

/** 검색 조건으로 더미 데이터 조회 (최대 50,000건) */
export async function fetchSearchResults(
  selectedA: string[],
  selectedB: string[],
  selectedC: string[],
): Promise<SearchResultRow[]> {
  const statuses = ['판매중', '품절', '입고대기', '할인중', '단종']
  const productNames = ['노트북', '스마트폰', '태블릿', '이어폰', '키보드', '마우스', '모니터', '충전기', '케이스', '필름']
  const results: SearchResultRow[] = []

  const totalCount = Math.min(
    50000,
    Math.max(10000, (selectedA.length || 10) * (selectedB.length || 10) * (selectedC.length || 5) * 20),
  )

  for (let i = 0; i < totalCount; i++) {
    results.push({
      id: i + 1,
      itemA: selectedA.length > 0 ? selectedA[i % selectedA.length] : `A-${String((i % 3000) + 1).padStart(4, '0')}`,
      itemB: selectedB.length > 0 ? selectedB[i % selectedB.length] : `B-${String((i % 2000) + 1).padStart(4, '0')}`,
      itemC: selectedC.length > 0 ? selectedC[i % selectedC.length] : `C-${String((i % 1500) + 1).padStart(4, '0')}`,
      productName: `${productNames[i % productNames.length]}-${i + 1}`,
      price: Math.floor(Math.random() * 990000) + 10000,
      stock: Math.floor(Math.random() * 500),
      status: statuses[i % statuses.length],
      createdAt: `2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
    })
  }

  return results
}
