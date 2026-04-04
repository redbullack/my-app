'use server'

/**
 * @description
 * 검색 페이지용 Server Actions.
 * Oracle DB의 CONNECT BY LEVEL을 활용하여 더미 데이터를 생성한다.
 * 모든 함수가 비동기 DB I/O를 사용하므로 이벤트 루프를 블로킹하지 않으며,
 * 독립적인 useTransition으로 호출 시 먼저 완료되는 순서대로 화면에 반영된다.
 *
 * 캐스케이딩 의존성:
 * - ITEM-A: 고정 3,000건 (카테고리)
 * - ITEM-B: selectedA.length 기반 (지역, 최대 2,000건)
 * - ITEM-C: condition.length 기반 (브랜드, 최대 1,500건)
 */

import { getDbClient } from '@/lib/db'
import type { SelectOption } from '@/types'

export type ItemType = 'A' | 'B' | 'C'

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

export interface ChartDataRow {
  label: string
  value: number
  color: string
}

const db = getDbClient()

/**
 * 통합 데이터소스 조회 함수.
 * @param type - 아이템 타입 (A | B | C)
 * @param condition - 상위 아이템의 선택값
 */
export async function fetchItemDataSource(
  type: ItemType,
  condition?: string[],
): Promise<SelectOption[]> {
  switch (type) {
    case 'A':
      return fetchItemA()
    case 'B':
      return fetchItemB(condition)
    case 'C':
      return fetchItemC(condition)
  }
}

/** ITEM-A 카테고리 데이터소스 (3,000건) */
async function fetchItemA(): Promise<SelectOption[]> {
  return db.query<SelectOption>(`
    SELECT
      'A-' || LPAD(LEVEL, 4, '0') AS "value",
      DECODE(MOD(LEVEL, 10),
        0,'전자제품', 1,'의류', 2,'식품', 3,'가구', 4,'도서',
        5,'스포츠', 6,'뷰티', 7,'자동차', 8,'음악', 9,'건강'
      ) || '-' || LPAD(LEVEL, 4, '0') AS "label"
    FROM DUAL
    CONNECT BY LEVEL <= 3000
  `)
}

/** ITEM-B 지역 데이터소스 (최대 2,000건) — selectedA 기반 */
async function fetchItemB(selectedA?: string[]): Promise<SelectOption[]> {
  const count = selectedA && selectedA.length > 0
    ? Math.min(2000, selectedA.length * 200)
    : 2000

  return db.query<SelectOption>(`
    SELECT
      'B-' || LPAD(LEVEL, 4, '0') AS "value",
      DECODE(MOD(LEVEL, 17),
        0,'서울', 1,'부산', 2,'대구', 3,'인천', 4,'광주',
        5,'대전', 6,'울산', 7,'세종', 8,'경기', 9,'강원',
        10,'충북', 11,'충남', 12,'전북', 13,'전남', 14,'경북',
        15,'경남', 16,'제주'
      ) || '-' || LPAD(LEVEL, 4, '0') AS "label"
    FROM DUAL
    CONNECT BY LEVEL <= :cnt
  `, { cnt: count })
}

/** ITEM-C 브랜드 데이터소스 (최대 1,500건) — selectedA + selectedB 기반 */
async function fetchItemC(condition?: string[]): Promise<SelectOption[]> {
  const count = condition && condition.length > 0
    ? Math.min(1500, condition.length * 100)
    : 1500

  return db.query<SelectOption>(`
    SELECT
      'C-' || LPAD(LEVEL, 4, '0') AS "value",
      DECODE(MOD(LEVEL, 12),
        0,'삼성', 1,'LG', 2,'현대', 3,'기아', 4,'SK', 5,'롯데',
        6,'CJ', 7,'한화', 8,'GS', 9,'포스코', 10,'네이버', 11,'카카오'
      ) || '-' || LPAD(LEVEL, 4, '0') AS "label"
    FROM DUAL
    CONNECT BY LEVEL <= :cnt
  `, { cnt: count })
}

/** 검색 결과 더미 데이터 조회 (최대 50,000건) */
export async function fetchSearchResults(
  selectedA: string[],
  selectedB: string[],
  selectedC: string[],
): Promise<SearchResultRow[]> {
  const totalCount = Math.min(
    50000,
    Math.max(10000, (selectedA.length || 10) * (selectedB.length || 10) * (selectedC.length || 5) * 20),
  )

  const aCount = selectedA.length || 3000
  const bCount = selectedB.length || 2000
  const cCount = selectedC.length || 1500

  return db.query<SearchResultRow>(`
    SELECT
      LEVEL AS "id",
      'A-' || LPAD(MOD(LEVEL - 1, :aCount) + 1, 4, '0') AS "itemA",
      'B-' || LPAD(MOD(LEVEL - 1, :bCount) + 1, 4, '0') AS "itemB",
      'C-' || LPAD(MOD(LEVEL - 1, :cCount) + 1, 4, '0') AS "itemC",
      DECODE(MOD(LEVEL, 10),
        0,'노트북', 1,'스마트폰', 2,'태블릿', 3,'이어폰', 4,'키보드',
        5,'마우스', 6,'모니터', 7,'충전기', 8,'케이스', 9,'필름'
      ) || '-' || LEVEL AS "productName",
      TRUNC(DBMS_RANDOM.VALUE(10000, 1000000)) AS "price",
      TRUNC(DBMS_RANDOM.VALUE(0, 500)) AS "stock",
      DECODE(MOD(LEVEL, 5),
        0,'판매중', 1,'품절', 2,'입고대기', 3,'할인중', 4,'단종'
      ) AS "status",
      '2026-' || LPAD(MOD(LEVEL - 1, 12) + 1, 2, '0')
        || '-' || LPAD(MOD(LEVEL - 1, 28) + 1, 2, '0') AS "createdAt"
    FROM DUAL
    CONNECT BY LEVEL <= :totalCount
  `, { aCount, bCount, cCount, totalCount })
}

/** 검색 결과를 status별로 집계한 차트 데이터 조회 */
export async function fetchChartData(
  selectedA: string[],
  selectedB: string[],
  selectedC: string[],
): Promise<ChartDataRow[]> {
  const totalCount = Math.min(
    50000,
    Math.max(10000, (selectedA.length || 10) * (selectedB.length || 10) * (selectedC.length || 5) * 20),
  )

  await new Promise(resolve => setTimeout(resolve, 5000))

  return db.query<ChartDataRow>(`
    SELECT
      s."label",
      s."value",
      DECODE(s."label",
        '판매중','success', '품절','error', '입고대기','warning',
        '할인중','info', '단종','text-muted'
      ) AS "color"
    FROM (
      SELECT
        DECODE(grp, 0,'판매중', 1,'품절', 2,'입고대기', 3,'할인중', 4,'단종') AS "label",
        COUNT(*) AS "value"
      FROM (
        SELECT MOD(LEVEL, 5) AS grp
        FROM DUAL
        CONNECT BY LEVEL <= :totalCount
      )
      GROUP BY grp
    ) s
    ORDER BY DECODE(s."label", '판매중',1, '품절',2, '입고대기',3, '할인중',4, '단종',5)
  `, { totalCount })
}

