'use server'

/**
 * @description
 * `app/test-0419/page.tsx` 전용 Server Actions.
 * - fetchEmpSimple: SCOTT.EMP 단순 조회
 * - runTxCommit: db.tx() 내에서 여러 UPDATE 후 commit
 * - runTxRollback: db.tx() 내에서 UPDATE 후 고의 throw → rollback 검증
 */

import { getDb } from '@/lib/db'
import { actionAgent } from '@/lib/utils/server'

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
    const result = await db.query<EmpSimpleRow>(SELECT_EMP)
    return result.rows
  })

/* ────────────────────────────────────────────────
 * 트랜잭션 테스트
 * ────────────────────────────────────────────────
 * 동일 커넥션 위에서 두 건의 SAL 을 +delta 만큼 증감.
 * - commit 모드: 콜백 정상 종료 → 두 건 모두 반영
 * - rollback 모드: 두 번째 UPDATE 직후 throw → 두 건 모두 원복
 *
 * `db.tx()` 콜백은 인자를 받지 않는다. 같은 `db` 객체로 호출한 query/execute 는
 * ALS 컨텍스트를 통해 자동으로 동일 트랜잭션 커넥션 위에서 수행된다.
 * 따라서 `readSal` 같은 헬퍼는 트랜잭션 안/밖에서 무수정으로 재사용 가능하다.
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

async function readSal(empno: string): Promise<string | null> {
  const result = await db.query<{ SAL: string | null }>(
    `SELECT TO_CHAR(SAL) AS "SAL" FROM SCOTT.EMP WHERE EMPNO = :empno`,
    { empno: Number(empno) },
  )
  return result.rows[0]?.SAL ?? null
}

export const runTxCommit = async (input: TxTestInput) =>
  actionAgent('runTxCommit', async (): Promise<TxTestResult> => {
    return db.tx(async () => {
      const beforeA = await readSal(input.empnoA)
      const beforeB = await readSal(input.empnoB)

      await db.execute(
        `UPDATE SCOTT.EMP SET SAL = SAL + :d WHERE EMPNO = :empno`,
        { d: input.delta, empno: Number(input.empnoA) },
      )
      await db.execute(
        `UPDATE SCOTT.EMP SET SAL = SAL + :d WHERE EMPNO = :empno`,
        { d: input.delta, empno: Number(input.empnoB) },
      )

      const afterA = await readSal(input.empnoA)
      const afterB = await readSal(input.empnoB)

      return { committed: true, beforeA, beforeB, afterA, afterB }
    })
  })

export const runTxTest = async () =>
  actionAgent('runTxTest', async (): Promise<number> => {
    let insertedRows = 0
    const testArr = ['1', '2', '3']

    // tx - start
    await db.tx(async () => {
      await db.execute(`INSERT INTO SCOTT.TEST_TABLE(COL1, COL2, COL3) SELECT 'TEST' COL1, '4' COL2, NULL COL3 FROM DUAL`)
      // await db.execute(`INSERT INTO SCOTT.TEST_TABLE(COL1, COL2, COL3) SELECT 'TEST' COL1, '4' COL2, NULL COL3 FROM DUAL`)

      for (const v of testArr) {
        const { rowsAffected } = await db.execute(`INSERT INTO SCOTT.TEST_TABLE(COL1, COL2, COL3) SELECT 'TEST' COL1, '${v}' COL2, NULL COL3 FROM DUAL`)
        insertedRows += rowsAffected
        console.log(`SERVER: runTxTest - insertedRows: ${insertedRows}`)
      }
    })
    // tx - end

    console.log(`SERVER: runTxTest - return insertedRows: ${insertedRows}`)
    return insertedRows
  })