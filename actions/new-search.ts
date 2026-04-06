'use server'

/**
 * @description
 * `app/new-search/page.tsx` 전용 Server Actions.
 * Oracle DB의 CONNECT BY LEVEL을 활용하여 더미 데이터를 생성한다.
 *
 * 기존 `actions/search.ts`와 분리한 이유:
 *  - search.ts의 fetchChartData가 학습용으로 항상 throw하도록 하드코딩되어 있어
 *    신규 페이지에서 정상 차트 fetch를 시연하기 위해 throw 없는 별도 함수가 필요했다.
 *  - 신규 페이지의 condValues 구조(6개 Input)가 기존 SearchResultRow와 다르므로
 *    타입과 SQL을 따로 두는 편이 명확하다.
 */

import { getDbClient } from '@/lib/db'
import type { SelectOption } from '@/types'

const db = getDbClient()

/* ── 타입 ── */

export interface NewSearchCond {
  i1: string[]
  i2: string[]
  i3: string[]
  i4: string[]
  i5: string
  i6: string[]
}

export interface NewSearchRow {
  id: number
  col1: string
  col2: string
  col3: string
  col4: string
  productName: string
  price: number
  stock: number
  status: string
  createdAt: string
}

export interface NewChartRow {
  label: string
  value: number
  color: string
}

/* ────────────────────────────────────────────────
 * Input 옵션 fetch — 캐스케이드
 * ────────────────────────────────────────────────*/

/**
 * Input 2 데이터소스 — Input 1의 선택값에 cascade.
 * SelectOption[] 반환. 10~100건 사이.
 */
export async function fetchInput2Options(
  selectedI1: string[],
): Promise<SelectOption[]> {
  await new Promise(resolve => setTimeout(resolve, 700))
  console.log(`SERVER: fetchInput2Options - selectedI1: ${selectedI1.map(v => v).join(',')}`)
  /* selectedI1 길이에 따라 옵션 개수 가변 (10 ~ 100건) */
  const count = Math.min(100, Math.max(10, (selectedI1.length || 1) * 15))

  return db.query<SelectOption>(
    `
    SELECT
      'I2-' || LPAD(LEVEL, 3, '0') AS "value",
      DECODE(MOD(LEVEL, 8),
        0,'서울지점', 1,'부산지점', 2,'대구지점', 3,'인천지점',
        4,'광주지점', 5,'대전지점', 6,'울산지점', 7,'세종지점'
      ) || '-' || LPAD(LEVEL, 3, '0') AS "label"
    FROM DUAL
    CONNECT BY LEVEL <= :cnt
    `,
    { cnt: count },
  )
}

/**
 * Input 3 데이터소스 — Input 1, 2의 선택값에 cascade.
 * SelectOption[] 반환. 10~100건 사이.
 */
export async function fetchInput3Options(
  selectedI1: string[],
  selectedI2: string[],
): Promise<SelectOption[]> {
  await new Promise(resolve => setTimeout(resolve, 800))
  console.log(`SERVER: fetchInput3Options - selectedI1: ${selectedI1.map(v => v).join(',')}`)

  const base = (selectedI1.length || 1) * (selectedI2.length || 1)
  const count = Math.min(100, Math.max(10, base * 5))

  return db.query<SelectOption>(
    `
    SELECT
      'I3-' || LPAD(LEVEL, 3, '0') AS "value",
      DECODE(MOD(LEVEL, 6),
        0,'담당A', 1,'담당B', 2,'담당C',
        3,'담당D', 4,'담당E', 5,'담당F'
      ) || '-' || LPAD(LEVEL, 3, '0') AS "label"
    FROM DUAL
    CONNECT BY LEVEL <= :cnt
    `,
    { cnt: count },
  )
}

/**
 * Input 4 데이터소스 — 캐스케이드 의존성 없음.
 * **string[] 반환** — Input.tsx의 string[] 정규화 경로 검증용.
 */
export async function fetchInput4Options(): Promise<string[]> {
  await new Promise(resolve => setTimeout(resolve, 600))

  const rows = await db.query<{ LABEL: string }>(
    `
    SELECT
      DECODE(MOD(LEVEL, 7),
        0,'우선순위-상', 1,'우선순위-중', 2,'우선순위-하',
        3,'긴급', 4,'보류', 5,'완료', 6,'취소'
      ) || '-' || LPAD(LEVEL, 3, '0') AS "LABEL"
    FROM DUAL
    CONNECT BY LEVEL <= 50
    `,
  )
  return rows.map(r => r.LABEL)
}

/**
 * Input 6 데이터소스 — 페이지 마운트 시 한 번 로드용.
 * SelectOption[] 반환.
 */
export async function fetchInput6Options(): Promise<SelectOption[]> {
  return db.query<SelectOption>(
    `
    SELECT
      'I6-' || LPAD(LEVEL, 3, '0') AS "value",
      DECODE(MOD(LEVEL, 5),
        0,'카테고리-A', 1,'카테고리-B', 2,'카테고리-C',
        3,'카테고리-D', 4,'카테고리-E'
      ) || '-' || LPAD(LEVEL, 3, '0') AS "label"
    FROM DUAL
    CONNECT BY LEVEL <= 30
    `,
  )
}

/* ────────────────────────────────────────────────
 * 검색 결과 fetch — Grid / Chart
 * ────────────────────────────────────────────────*/

/**
 * 그리드용 검색 결과. 빠르게 응답 (300~600ms).
 */
export async function fetchNewSearchGrid(
  cond: NewSearchCond,
): Promise<NewSearchRow[]> {
  // await new Promise(resolve => setTimeout(resolve, 600))

  console.log(`SERVER: fetchNewSearchGrid - cond.i1: ${cond.i1.map(v => v).join(',')}`)
  console.log(`SERVER: fetchNewSearchGrid - cond.i2: ${cond.i2.map(v => v).join(',')}`)
  console.log(`SERVER: fetchNewSearchGrid - cond.i3: ${cond.i3.map(v => v).join(',')}`)
  console.log(`SERVER: fetchNewSearchGrid - cond.i4: ${cond.i4.map(v => v).join(',')}`)
  console.log(`SERVER: fetchNewSearchGrid - cond.i5: ${cond.i5.toString()}`)
  console.log(`SERVER: fetchNewSearchGrid - cond.i6: ${cond.i6.map(v => v).join(',')}`)

  const i1c = cond.i1.length || 5
  const i2c = cond.i2.length || 5
  const i3c = cond.i3.length || 5
  const i4c = cond.i4.length || 5
  const i6c = cond.i6.length || 5

  const totalCount = Math.min(
    20000,
    Math.max(2000, i1c * i2c * i3c * i4c * i6c * 10),
  )

  return db.query<NewSearchRow>(
    `
    SELECT
      LEVEL AS "id",
      'C1-' || LPAD(MOD(LEVEL - 1, :i1c) + 1, 3, '0') AS "col1",
      'C2-' || LPAD(MOD(LEVEL - 1, :i2c) + 1, 3, '0') AS "col2",
      'C3-' || LPAD(MOD(LEVEL - 1, :i3c) + 1, 3, '0') AS "col3",
      'C4-' || LPAD(MOD(LEVEL - 1, :i4c) + 1, 3, '0') AS "col4",
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
    `,
    { i1c, i2c, i3c, i4c, totalCount },
  )
}

/**
 * 차트용 검색 결과. 그리드보다 느리게 응답 (1500~2000ms) — race 가시화.
 * **throw 없이 정상 동작.**
 */
export async function fetchNewSearchChart(
  cond: NewSearchCond,
): Promise<NewChartRow[]> {
  await new Promise(resolve => setTimeout(resolve, 2000))

  console.log(`SERVER: fetchNewSearchChart - cond.i1: ${cond.i1.map(v => v).join(',')}`)
  console.log(`SERVER: fetchNewSearchChart - cond.i2: ${cond.i2.map(v => v).join(',')}`)
  console.log(`SERVER: fetchNewSearchChart - cond.i3: ${cond.i3.map(v => v).join(',')}`)
  console.log(`SERVER: fetchNewSearchChart - cond.i4: ${cond.i4.map(v => v).join(',')}`)
  console.log(`SERVER: fetchNewSearchChart - cond.i5: ${cond.i5.toString()}`)
  console.log(`SERVER: fetchNewSearchChart - cond.i6: ${cond.i6.map(v => v).join(',')}`)

  const i1c = cond.i1.length || 5
  const i2c = cond.i2.length || 5
  const totalCount = Math.max(2000, i1c * i2c * 200)

  return db.query<NewChartRow>(
    `
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
    `,
    { totalCount },
  )
}

/**
 * 셀 더블클릭 시 해당 셀 값을 기반으로 차트 분포 조회.
 * column key + value를 시드로 활용해 임의의 분포 데이터를 반환.
 */
export async function fetchChartByCell(
  columnKey: string,
  cellValue: unknown,
): Promise<NewChartRow[]> {
  await new Promise(resolve => setTimeout(resolve, 900))

  /* cellValue를 문자열 길이 기반의 가변 카운트로 변환 (시드 역할) */
  const seed = String(cellValue ?? '').length || 1
  const totalCount = Math.max(500, seed * 1500)

  return db.query<NewChartRow>(
    `
    SELECT
      s."label",
      s."value",
      DECODE(s."label",
        :k1,'success', :k2,'error', :k3,'warning',
        :k4,'info', :k5,'text-muted'
      ) AS "color"
    FROM (
      SELECT
        DECODE(grp,
          0, :k1, 1, :k2, 2, :k3, 3, :k4, 4, :k5
        ) AS "label",
        COUNT(*) AS "value"
      FROM (
        SELECT MOD(LEVEL, 5) AS grp
        FROM DUAL
        CONNECT BY LEVEL <= :totalCount
      )
      GROUP BY grp
    ) s
    ORDER BY DECODE(s."label",
      :k1,1, :k2,2, :k3,3, :k4,4, :k5,5
    )
    `,
    {
      totalCount,
      k1: `${columnKey}-구간1`,
      k2: `${columnKey}-구간2`,
      k3: `${columnKey}-구간3`,
      k4: `${columnKey}-구간4`,
      k5: `${columnKey}-구간5`,
    },
  )
}
