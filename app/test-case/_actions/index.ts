'use server'

/**
 * @description
 * app/test-case 전용 Server Actions — 모든 에러 케이스를 재현한다.
 *
 * ─────────────────────────────────────────────────────────────────
 * 케이스 목록
 * ─────────────────────────────────────────────────────────────────
 * C-1  actionNormalError        일반 Error throw (try/catch로 잡아 반환)
 * C-2  actionDbQueryError       잘못된 SQL → DbError (ORA-00942 등)
 * C-3  actionDbConnectionError  존재하지 않는 DB 이름 → getDb() 단에서 에러
 * C-4  actionDbConstraintError  PK 중복 INSERT → DbError(constraint)
 * C-5  actionUncaught           try/catch 없이 throw → Next.js instrumentation 레이어로 전파
 *                               (서버 콘솔에서 확인. 브라우저는 "An error occurred in the Server Components" 메시지)
 * ─────────────────────────────────────────────────────────────────
 */

import { getDb, DbError } from '@/lib/db'

/* ── 공통 반환 타입 ─────────────────────────────────────────────── */

export interface ActionResult {
  success: boolean
  errorCase: string
  errorType: string
  message: string
  detail?: string
  handledBy: string
}

/* ── C-1: 일반 Error ────────────────────────────────────────────── */

export async function actionNormalError(): Promise<ActionResult> {
  try {
    throw new Error('의도적으로 발생시킨 일반 서버 에러 (C-1)')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Server Action C-1] normalError:', msg)
    return {
      success: false,
      errorCase: 'C-1',
      errorType: 'Error',
      message: msg,
      handledBy: 'Server Action try/catch → ActionResult 반환',
    }
  }
}

/* ── C-2: DB Query 오류 (잘못된 SQL) ───────────────────────────── */

export async function actionDbQueryError(): Promise<ActionResult> {
  const db = getDb('MAIN')
  try {
    // 존재하지 않는 테이블 — ORA-00942: table or view does not exist
    await db.query('SELECT * FROM NONEXISTENT_TABLE_XYZ WHERE 1=1')
    return { success: true, errorCase: 'C-2', errorType: '-', message: '에러가 발생하지 않았습니다', handledBy: '-' }
  } catch (err) {
    const isDbErr = err instanceof DbError
    const msg = isDbErr ? (err as DbError).message : (err instanceof Error ? err.message : String(err))
    const detail = isDbErr
      ? `category=${(err as DbError).category} | code=${(err as DbError).code}`
      : undefined
    console.error('[Server Action C-2] dbQueryError:', err)
    return {
      success: false,
      errorCase: 'C-2',
      errorType: isDbErr ? `DbError(${(err as DbError).category})` : 'Error',
      message: msg,
      detail,
      handledBy: 'Server Action try/catch → ActionResult 반환',
    }
  }
}

/* ── C-3: DB Connection 오류 (잘못된 DB 이름) ──────────────────── */

export async function actionDbConnectionError(): Promise<ActionResult> {
  try {
    // @ts-expect-error 의도적으로 존재하지 않는 DB 이름 전달
    const db = getDb('INVALID_DB_NAME_XYZ')
    await db.query('SELECT 1 FROM DUAL')
    return { success: true, errorCase: 'C-3', errorType: '-', message: '에러가 발생하지 않았습니다', handledBy: '-' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const isDbErr = err instanceof DbError
    console.error('[Server Action C-3] dbConnectionError:', err)
    return {
      success: false,
      errorCase: 'C-3',
      errorType: isDbErr ? `DbError(${(err as DbError).category})` : 'Error',
      message: msg,
      detail: isDbErr ? `category=${(err as DbError).category}` : undefined,
      handledBy: 'Server Action try/catch → ActionResult 반환',
    }
  }
}

/* ── C-4: DB Constraint 위반 (PK 중복 INSERT) ──────────────────── */

export async function actionDbConstraintError(): Promise<ActionResult> {
  const db = getDb('MAIN')
  try {
    // SCOTT.DEPT DEPTNO=10 은 이미 존재하므로 PK 위반 (ORA-00001)
    await db.execute(
      `INSERT INTO SCOTT.DEPT (DEPTNO, DNAME, LOC) VALUES (:deptno, :dname, :loc)`,
      { deptno: 10, dname: 'TEST', loc: 'TEST' },
    )
    return { success: true, errorCase: 'C-4', errorType: '-', message: '에러가 발생하지 않았습니다', handledBy: '-' }
  } catch (err) {
    const isDbErr = err instanceof DbError
    const msg = isDbErr ? (err as DbError).message : (err instanceof Error ? err.message : String(err))
    const detail = isDbErr
      ? `category=${(err as DbError).category} | code=${(err as DbError).code}`
      : undefined
    console.error('[Server Action C-4] dbConstraintError:', err)
    return {
      success: false,
      errorCase: 'C-4',
      errorType: isDbErr ? `DbError(${(err as DbError).category})` : 'Error',
      message: msg,
      detail,
      handledBy: 'Server Action try/catch → ActionResult 반환',
    }
  }
}

/* ── C-5: Uncaught Server Error (try/catch 없음) ────────────────
 *
 * ⚠️ 이 액션은 try/catch 없이 throw한다.
 *    → Next.js가 Server Action 에러를 잡아 클라이언트에 "Internal Server Error"를 반환.
 *    → instrumentation.ts 가 활성화되어 있으면 onRequestError() 콜백으로 전달된다.
 *      (현재 _instrumentation.ts 로 비활성 상태 — 활성화하려면 파일명을 instrumentation.ts 로 변경)
 *    → 서버 터미널 콘솔에서 에러 스택 확인.
 *    → 클라이언트에서는 try/catch로 잡으면 "An error occurred..." 형태의 Error 객체가 온다.
 */
export async function actionUncaught(): Promise<ActionResult> {
  // 의도적 — try/catch 없음
  throw new Error('C-5: Uncaught Server Action 에러 — instrumentation.ts 레이어로 전파')
}
