'use server'

/**
 * @description
 * `app/test-0409/page.tsx` 전용 Server Actions.
 * - SCOTT.EMP / DEPT / SALGRADE 조인 결과 조회
 * - DNAME → JOB → ENAME 의 cascade 셀렉트 옵션 조회 (FROM DUAL)
 * - 모든 메서드는 쿼리 실행 전 1.2초 딜레이를 갖는다 (학습용)
 */

import { getDb } from '@/lib/db'

const db = getDb('MAIN')

const DELAY_MS = 1200
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/* ── 조회 결과 타입 ── */

export interface EmpRow {
  EMPNO: string
  ENAME: string | null
  JOB: string | null
  MGR: string | null
  HIREDATE: string | null
  SAL: string | null
  GRADE: string | null
  COMM: string | null
  DEPTNO: string | null
  DNAME: string | null
  LOC: string | null
}

export interface EmpSearchCond {
  dname: string[]
  job: string[]
  ename: string[]
}

/* ────────────────────────────────────────────────
 * Grid 조회
 * ────────────────────────────────────────────────*/

export async function fetchEmpList(cond: EmpSearchCond): Promise<EmpRow[]> {
  // await sleep(DELAY_MS)

  const binds: Record<string, unknown> = {}
  const where: string[] = ['1 = 1']

  if (cond.dname.length > 0) {
    const keys = cond.dname.map((v, i) => {
      const k = `dname${i}`
      binds[k] = v
      return `:${k}`
    })
    where.push(`DEPT.DNAME IN (${keys.join(', ')})`)
  }
  if (cond.job.length > 0) {
    const keys = cond.job.map((v, i) => {
      const k = `job${i}`
      binds[k] = v
      return `:${k}`
    })
    where.push(`EMP.JOB IN (${keys.join(', ')})`)
  }
  if (cond.ename.length > 0) {
    const keys = cond.ename.map((v, i) => {
      const k = `ename${i}`
      binds[k] = v
      return `:${k}`
    })
    where.push(`EMP.ENAME IN (${keys.join(', ')})`)
  }

  return db.query<EmpRow>(
    `
    SELECT TO_CHAR(EMP.EMPNO)    AS "EMPNO"
         , EMP.ENAME             AS "ENAME"
         , EMP.JOB               AS "JOB"
         , TO_CHAR(EMP.MGR)      AS "MGR"
         , TO_CHAR(EMP.HIREDATE, 'YYYY-MM-DD') AS "HIREDATE"
         , TO_CHAR(EMP.SAL)      AS "SAL"
         , TO_CHAR(SALGRADE.GRADE) AS "GRADE"
         , TO_CHAR(EMP.COMM)     AS "COMM"
         , TO_CHAR(EMP.DEPTNO)   AS "DEPTNO"
         , DEPT.DNAME            AS "DNAME"
         , DEPT.LOC              AS "LOC"
      FROM SCOTT.EMP
      LEFT JOIN SCOTT.DEPT
        ON DEPT.DEPTNO = EMP.DEPTNO
      LEFT JOIN SCOTT.SALGRADE
        ON EMP.SAL >= SALGRADE.LOSAL AND EMP.SAL <= SALGRADE.HISAL
     WHERE ${where.join(' AND ')}
     ORDER BY EMP.EMPNO
    `,
    binds,
  )
}

/* ────────────────────────────────────────────────
 * Cascade Select 옵션 조회 (FROM DUAL)
 * ────────────────────────────────────────────────
 * 실제 SCOTT 스키마에 의존하지 않고, 14건의 정적 데이터를
 * UNION ALL로 구성한 인라인 뷰에서 조건에 맞춰 distinct 추출.
 */

const EMP_INLINE_VIEW = `
  SELECT 'MILLER' AS ENAME, 'CLERK'     AS JOB, 'ACCOUNTING' AS DNAME FROM DUAL UNION ALL
  SELECT 'CLARK',  'MANAGER',   'ACCOUNTING' FROM DUAL UNION ALL
  SELECT 'KING',   'PRESIDENT', 'ACCOUNTING' FROM DUAL UNION ALL
  SELECT 'FORD',   'ANALYST',   'RESEARCH'   FROM DUAL UNION ALL
  SELECT 'SCOTT',  'ANALYST',   'RESEARCH'   FROM DUAL UNION ALL
  SELECT 'ADAMS',  'CLERK',     'RESEARCH'   FROM DUAL UNION ALL
  SELECT 'SMITH',  'CLERK',     'RESEARCH'   FROM DUAL UNION ALL
  SELECT 'JONES',  'MANAGER',   'RESEARCH'   FROM DUAL UNION ALL
  SELECT 'JAMES',  'CLERK',     'SALES'      FROM DUAL UNION ALL
  SELECT 'BLAKE',  'MANAGER',   'SALES'      FROM DUAL UNION ALL
  SELECT 'ALLEN',  'SALESMAN',  'SALES'      FROM DUAL UNION ALL
  SELECT 'MARTIN', 'SALESMAN',  'SALES'      FROM DUAL UNION ALL
  SELECT 'TURNER', 'SALESMAN',  'SALES'      FROM DUAL UNION ALL
  SELECT 'WARD',   'SALESMAN',  'SALES'      FROM DUAL
`

function buildInClause(
  column: string,
  values: string[],
  prefix: string,
  binds: Record<string, unknown>,
): string | null {
  if (values.length === 0) return null
  const keys = values.map((v, i) => {
    const k = `${prefix}${i}`
    binds[k] = v
    return `:${k}`
  })
  return `${column} IN (${keys.join(', ')})`
}

/** DNAME 옵션 — cascade 의존성 없음 */
export async function fetchDnameOptions(): Promise<string[]> {
  // await sleep(DELAY_MS)
  const rows = await db.query<{ VALUE: string }>(
    `
    SELECT DISTINCT DNAME AS "VALUE"
      FROM (${EMP_INLINE_VIEW})
     ORDER BY DNAME
    `,
  )
  return rows.map(r => r.VALUE)
}

/** JOB 옵션 — DNAME에 cascade */
export async function fetchJobOptions(selectedDname: string[]): Promise<string[]> {
  // await sleep(DELAY_MS)
  const binds: Record<string, unknown> = {}
  const where = buildInClause('DNAME', selectedDname, 'dname', binds)
  const rows = await db.query<{ VALUE: string }>(
    `
    SELECT DISTINCT JOB AS "VALUE"
      FROM (${EMP_INLINE_VIEW})
     ${where ? `WHERE ${where}` : ''}
     ORDER BY JOB
    `,
    binds,
  )
  return rows.map(r => r.VALUE)
}

/** ENAME 옵션 — DNAME + JOB에 cascade */
export async function fetchEnameOptions(
  selectedDname: string[],
  selectedJob: string[],
): Promise<string[]> {
  await sleep(DELAY_MS)
  const binds: Record<string, unknown> = {}
  const conds = [
    buildInClause('DNAME', selectedDname, 'dname', binds),
    buildInClause('JOB', selectedJob, 'job', binds),
  ].filter((c): c is string => c !== null)

  const rows = await db.query<{ VALUE: string }>(
    `
    SELECT DISTINCT ENAME AS "VALUE"
      FROM (${EMP_INLINE_VIEW})
     ${conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : ''}
     ORDER BY ENAME
    `,
    binds,
  )
  return rows.map(r => r.VALUE)
}
