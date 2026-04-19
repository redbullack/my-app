'use server'

/**
 * @description
 * `app/test-0419/page.tsx` 전용 Server Actions.
 * - fetchEmpSimple: SCOTT.EMP 단순 조회
 * - runTxCommit: db.transaction() 내에서 여러 UPDATE 후 commit
 * - runTxRollback: db.transaction() 내에서 UPDATE 후 고의 throw → rollback 검증
 */

import { getDb } from '@/lib/db/factory-new'
import { actionAgent } from '@/lib/utils/server/actionWrapper'

const db = getDb('MAIN')

export interface EmpSimpleRow {
  EMPNO: string
  ENAME: string | null
  JOB: string | null
  SAL: string | null
  DEPTNO: string | null
}

const SELECT_EMP = `
  SELECT TO_CHAR(EMPNO)  AS "EMPNO"
       , ENAME           AS "ENAME"
       , JOB             AS "JOB"
       , TO_CHAR(SAL)    AS "SAL"
       , TO_CHAR(DEPTNO) AS "DEPTNO"
    FROM SCOTT.EMP
   ORDER BY EMPNO
`

export const fetchEmpSimple = async () =>
  actionAgent('fetchEmpSimple', async (): Promise<EmpSimpleRow[]> => {
    return db.query<EmpSimpleRow>(SELECT_EMP)
  })

/* ────────────────────────────────────────────────
 * 트랜잭션 테스트
 * ────────────────────────────────────────────────
 * 동일 커넥션 위에서 두 건의 SAL 을 +delta 만큼 증감.
 * - commit 모드: 콜백 정상 종료 → 두 건 모두 반영
 * - rollback 모드: 두 번째 UPDATE 직후 throw → 두 건 모두 원복
 */

export interface TxTestInput {
  empnoA: string
  empnoB: string
  delta: number
}

export interface TxTestResult {
  committed: boolean
  beforeA: string | null
  beforeB: string | null
  afterA: string | null
  afterB: string | null
}

async function readSal(
  client: { query: typeof db.query },
  empno: string,
): Promise<string | null> {
  const rows = await client.query<{ SAL: string | null }>(
    `SELECT TO_CHAR(SAL) AS "SAL" FROM SCOTT.EMP WHERE EMPNO = :empno`,
    { empno: Number(empno) },
  )
  return rows[0]?.SAL ?? null
}

export const runTxCommit = async (input: TxTestInput) =>
  actionAgent('runTxCommit', async (): Promise<TxTestResult> => {
    let beforeA: string | null = null
    let beforeB: string | null = null
    let afterA: string | null = null
    let afterB: string | null = null

    await db.transaction(async tx => {
      beforeA = await readSal(tx, input.empnoA)
      beforeB = await readSal(tx, input.empnoB)

      await tx.execute(
        `UPDATE SCOTT.EMP SET SAL = SAL + :d WHERE EMPNO = :empno`,
        { d: input.delta, empno: Number(input.empnoA) },
      )
      await tx.execute(
        `UPDATE SCOTT.EMP SET SAL = SAL + :d WHERE EMPNO = :empno`,
        { d: input.delta, empno: Number(input.empnoB) },
      )

      afterA = await readSal(tx, input.empnoA)
      afterB = await readSal(tx, input.empnoB)
    })

    return { committed: true, beforeA, beforeB, afterA, afterB }
  })

export const runTxRollback = async (input: TxTestInput) =>
  actionAgent('runTxRollback', async (): Promise<TxTestResult> => {
    let beforeA: string | null = null
    let beforeB: string | null = null
    let afterA: string | null = null
    let afterB: string | null = null

    try {
      await db.transaction(async tx => {
        beforeA = await readSal(tx, input.empnoA)
        beforeB = await readSal(tx, input.empnoB)

        await tx.execute(
          `UPDATE SCOTT.EMP SET SAL = SAL + :d WHERE EMPNO = :empno`,
          { d: input.delta, empno: Number(input.empnoA) },
        )
        await tx.execute(
          `UPDATE SCOTT.EMP SET SAL = SAL + :d WHERE EMPNO = :empno`,
          { d: input.delta, empno: Number(input.empnoB) },
        )

        afterA = await readSal(tx, input.empnoA)
        afterB = await readSal(tx, input.empnoB)

        throw new Error('__forced_rollback__')
      })
    } catch (err) {
      if ((err as Error)?.message !== '__forced_rollback__') throw err
    }

    return { committed: false, beforeA, beforeB, afterA, afterB }
  })
