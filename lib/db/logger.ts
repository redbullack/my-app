/**
 * @module lib/db/logger
 * @description
 * DB 쿼리 이력을 운영 DB(`MAIN`)의 로그 테이블에 한 줄로 적재한다.
 *
 * 단일 함수 `insertLogQuery(fields)` 만 export — 호출자는 `void insertLogQuery(...)` 형태로
 * fire-and-forget 호출하여 응답 지연에 영향을 주지 않는다. INSERT 실패는 비즈니스 흐름을 막지 않는다.
 *
 * 재귀 방지:
 *  - 이 모듈의 INSERT 자체도 `getDb('MAIN').execute(...)` 를 거치므로 factory 의
 *    로깅 경로를 다시 트리거할 수 있다.
 *  - `loggingScope` ALS 플래그를 INSERT 주변에 `run(true, ...)` 으로 두르고,
 *    factory 의 로깅 진입부에서 이 플래그를 확인해 즉시 skip 하도록 한다.
 *  - 이 방식은 SQL 패턴 매칭(취약) 이나 별도 우회 경로(이중 코드) 없이 정확히 한 단계에서만 차단된다.
 *
 * STATUS 결정:
 *  - `errorDesc` 가 있으면 'FAIL', 없으면 'OK'. 호출자는 outcome 별 분기 없이
 *    같은 함수에 같은 필드 셋을 넘기면 된다.
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import { getRequestCtx } from '@/lib/utils/server/requestContext'
import { getDb } from './factory'

/** factory 가 로깅 경로 진입 전에 확인하는 재귀 가드 플래그. */
export const loggingScope = new AsyncLocalStorage<true>()

/**
 * factory 가 넘기는 쿼리 메타 (사용자 컨텍스트는 insertLogQuery 가 직접 조회).
 */
export interface LogInfo {
  db?: string
  provider?: string
  op?: string
  sql?: string
  startedAt?: string
  endedAt?: string
  rowCount?: number
  /** 있으면 STATUS='FAIL', 없으면 'OK'. `util.inspect(err, ...)` 결과 그대로. */
  errorDesc?: string
}

/** SQL preview — 앞 200자, 줄바꿈/공백 정규화. */
export function sqlPreview(sql: string, max = 200): string {
  const flat = sql.replace(/\s+/g, ' ').trim()
  return flat.length <= max ? flat : flat.slice(0, max) + '…'
}

/**
 * 쿼리 이력 1건 적재. 호출자는 `void insertLogQuery(...)` 형태로 fire-and-forget 호출한다.
 * 로그 INSERT 자체는 `loggingScope.run(true, ...)` 안에서 실행되어 factory 의
 * 재귀 로깅을 차단한다.
 */
export async function insertLogQuery(fields: LogInfo): Promise<void> {
  try {
    // 사용자 컨텍스트는 logger 가 직접 조회 — factory 는 쿼리 메타만 넘기면 된다.
    const reqCtx = await getRequestCtx()
    await loggingScope.run(true, async () => {
      await getDb('MAIN').execute(
        `INSERT INTO SCOTT.NEXT_TEST_LOG_QUERY
          (DB_NAME, PROVIDER, OP, SQL_PREVIEW,
           STATUS, STARTED_AT, ENDED_AT, ROW_COUNT,
           PAGE_PATH, USER_ID, USER_NAME, ROLE, EMPNO,
           ERROR_DESC, CREATED_AT)
         VALUES
          (:dbName, :provider, :op, :sql,
           :status, :startedAt, :endedAt, :rowCount,
           :pagePath, :userId, :userName, :role, :empno,
           :errorDesc, SYSDATE)`,
        {
          dbName:     fields.db         ?? null,
          provider:   fields.provider   ?? null,
          op:         fields.op         ?? null,
          // sqlPreview: typeof fields.sql === 'string' ? fields.sql : null,
          sql: typeof fields.sql === 'string' ? fields.sql : null,
          status:     fields.errorDesc ? 'FAIL' : 'OK',
          startedAt:  fields.startedAt  ?? null,
          endedAt:    fields.endedAt    ?? null,
          rowCount:   fields.rowCount   ?? null,
          pagePath:   reqCtx.pagePath   ?? null,
          userId:     reqCtx.userId     ?? null,
          userName:   reqCtx.userName   ?? null,
          role:       reqCtx.role       ?? null,
          empno:      reqCtx.empno      ?? null,
          errorDesc:  fields.errorDesc  ?? null,
        },
      )
    })
  } catch (err) {
    // 로그 INSERT 실패는 절대 비즈니스 흐름을 막지 않는다. stdout 으로만 남기고 무시.
    console.warn('[db.log.insert.failed]', err)
  }
}
