'use server'

/**
 * @description
 * `app/test-0512/page.tsx` 전용 Server Actions.
 * - fetchJobOptions: JOB 옵션 (cascade root)
 * - fetchEmpnoOptions: 선택된 JOB에 cascade된 EMPNO 옵션
 * - fetchEnameOptions: 선택된 JOB에 cascade된 ENAME 옵션
 * - fetchEmpList: JOB(필수) + EMPNO + ENAME 조건으로 SCOTT.EMP 조회
 */

import { getDb, QueryResult } from '@/lib/db'
import { randomUUID } from 'node:crypto'

const db = getDb('MAIN')

function buildInClause(
  column: string,
  values: string[],
  prefix: string,
  binds: Record<string, unknown>,
  cast?: (v: string) => unknown,
): string | null {
  if (values.length === 0) return null
  const keys = values.map((v, i) => {
    const k = `${prefix}${i}`
    binds[k] = cast ? cast(v) : v
    return `:${k}`
  })
  return `${column} IN (${keys.join(', ')})`
}

export async function fetchJobOptions() {
    const result = await db.query<{ VALUE: string }>(
      `SELECT DISTINCT JOB AS "VALUE"
         FROM SCOTT.EMP
        WHERE JOB IS NOT NULL
        ORDER BY 1`,
    )
    return result.rows.map(r => r.VALUE)
}

export async function fetchEmpnoOptions(selectedJob: string[]) {
    const binds: Record<string, unknown> = {}
    const where = buildInClause('JOB', selectedJob, 'job', binds)
    const result = await db.query<{ VALUE: string }>(
      `SELECT DISTINCT TO_CHAR(EMPNO) AS "VALUE"
         FROM SCOTT.EMP
        ${where ? `WHERE ${where}` : ''}
        ORDER BY 1`,
      binds,
    )
    return result.rows.map(r => r.VALUE)
}

export async function fetchEnameOptions(selectedJob: string[]) {
    const binds: Record<string, unknown> = {}
    const where = buildInClause('JOB', selectedJob, 'job', binds)
    const result = await db.query<{ VALUE: string }>(
      `SELECT DISTINCT ENAME AS "VALUE"
         FROM SCOTT.EMP
        WHERE ENAME IS NOT NULL
          ${where ? `AND ${where}` : ''}
        ORDER BY 1`,
      binds,
    )
    return result.rows.map(r => r.VALUE)
}

export interface EmpSearchCond {
  job: string[]
  empno: string[]
  ename: string[]
}

export interface EmpRow {
  EMPNO: string
  ENAME: string | null
  JOB: string | null
  MGR: string | null
  HIREDATE: string | null
  SAL: string | null
  COMM: string | null
  DEPTNO: string | null
}

export async function fetchEmpList(cond: EmpSearchCond) {
    const binds: Record<string, unknown> = {}
    const where = [
      buildInClause('JOB', cond.job, 'job', binds),
      buildInClause('EMPNO', cond.empno, 'empno', binds, v => Number(v)),
      buildInClause('ENAME', cond.ename, 'ename', binds),
    ].filter((c): c is string => c !== null)

    let result = {} as QueryResult<EmpRow>

    await db.transaction(async () => {
      await db.execute(`INSERT INTO SCOTT.TEST_TABLE VALUES('${randomUUID()}', '${randomUUID()}', '${randomUUID()}', SYSDATE)`)

      await db.query(`SELECT 'TEST 2' COL FROM DUAL`)

      result = await db.query<EmpRow>(
        `SELECT TO_CHAR(EMPNO)                       AS "EMPNO"
              , ENAME                                AS "ENAME"
              , JOB                                  AS "JOB"
              , TO_CHAR(MGR)                         AS "MGR"
              , TO_CHAR(HIREDATE, 'YYYY-MM-DD')      AS "HIREDATE"
              , TO_CHAR(SAL)                         AS "SAL"
              , TO_CHAR(COMM)                        AS "COMM"
              , TO_CHAR(DEPTNO)                      AS "DEPTNO"
          FROM SCOTT.EMP
          ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
          ORDER BY EMPNO`,
        binds,
      )

      await db.query(`SELECT 'TEST 1' COL FROM DUAL`)
    })

    return result
}
