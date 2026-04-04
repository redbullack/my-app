/**
 * @module lib/search-queries
 * @description
 * 검색 페이지의 Grid / Chart 데이터 조회 로직.
 * Server Action이 아닌 일반 서버 모듈로, Route Handler에서 import하여 사용한다.
 * 이렇게 분리하면 두 Route Handler가 완전히 독립적인 HTTP 요청으로 병렬 실행된다.
 */

import { getDbClient } from '@/lib/db'
import type { SearchResultRow, ChartDataRow } from '@/actions/search'

const db = getDbClient()

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
