/**
 * @module lib/db/logger-new
 * @description
 * DB 쿼리 이력을 운영 DB(`MAIN`)의 로그 테이블에 한 줄로 적재한다.
 *
 * 호출 규약:
 *  - 단일 함수 `insertLogQuery(fields)` 만 export.
 *  - 호출자는 `void insertLogQuery(...)` fire-and-forget 으로 사용. INSERT 실패는
 *    비즈니스 흐름을 막지 않으며 stdout 으로만 경고를 남긴다.
 *  - STATUS 는 `errorDesc` 유무로 자동 결정 ('FAIL' / 'OK').
 *  - 호출자(db.ts) 가 MAIN DbDriver 와 next-auth `Session` 을 함께 넘긴다 — 본 모듈은
 *    그것으로 INSERT 한다. 이 우회 경로 덕에 agent.execute 의 로깅 훅과 재귀하지 않는다.
 */

import type { Session } from 'next-auth'
import type { DbDriver } from './db'

export interface LogInfo {
  dbDriver: DbDriver
  /** db.ts 의 getDb({ isUserRequierd }) 에 따라 채워지는 next-auth 세션. 없으면 익명. */
  userInfo?: Session
  db?: string
  provider?: string
  sql?: string
  /** Date 객체 그대로. SCOTT.NEXT_TEST_LOG_QUERY.STARTED_AT 은 DATE 컬럼. */
  startedAt?: Date
  endedAt?: Date
  rowCount?: number
  /** 있으면 STATUS='FAIL', 없으면 'OK'. `util.inspect(err, ...)` 결과 그대로. */
  errorDesc?: string
}

export async function insertLogQuery(fields: LogInfo): Promise<void> {
  const { dbDriver, userInfo } = fields
  let conn: unknown | undefined
  try {
    conn = await dbDriver.getConnection()
    await dbDriver.rawExecute(
      conn,
      `INSERT INTO SCOTT.NEXT_TEST_LOG_QUERY
          (DB_NAME, PROVIDER, SQL_PREVIEW,
           STATUS, STARTED_AT, ENDED_AT, ROW_COUNT,
           USER_ID, USER_NAME, ROLE, EMPNO,
           ERROR_DESC, CREATED_AT)
         VALUES
          (:dbName, :provider, :sql,
           :status, :startedAt, :endedAt, :rowCount,
           :userId, :userName, :role, :empno,
           :errorDesc, SYSDATE)`,
      {
        dbName:    fields.db        ?? null,
        provider:  fields.provider  ?? null,
        sql:       typeof fields.sql === 'string' ? fields.sql : null,
        status:    fields.errorDesc ? 'FAIL' : 'OK',
        startedAt: fields.startedAt ?? null,
        endedAt:   fields.endedAt   ?? null,
        rowCount:  fields.rowCount  ?? null,
        userId:    userInfo?.user.id    ?? null,
        userName:  userInfo?.user.name  ?? null,
        role:      userInfo?.user.role  ?? null,
        empno:     userInfo?.user.empno ?? null,
        errorDesc: fields.errorDesc ?? null,
      },
      true, // autoCommit — 사용자 트랜잭션과 완전히 분리
    )
  } catch (err) {
    console.warn('[db.log.insert.failed]', err)
  } finally {
    if (conn) {
      try { await dbDriver.release(conn) } catch { /* noop */ }
    }
  }
}
