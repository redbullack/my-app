/**
 * @module lib/db/logger
 * @description
 * DB 쿼리 이력을 운영 DB(`MAIN`)의 로그 테이블에 한 줄로 적재한다.
 *
 * 단일 함수 `insertLogQuery(fields)` 만 export — 호출자는 `void insertLogQuery(...)` 형태로
 * fire-and-forget 호출하여 응답 지연에 영향을 주지 않는다. INSERT 실패는 비즈니스 흐름을 막지 않는다.
 *
 * factory 우회 (중요):
 *  - 로그 INSERT 는 `getDb('MAIN').execute(...)` 가 아니라 provider 를 **직접** 호출한다.
 *  - factory 를 거치면 `txStore` 가 활성화된 호출 컨텍스트에서 로그 INSERT 가
 *    사용자 트랜잭션 커넥션에 enlist 되어 버린다 (rollback 시 로그 유실, 트랜잭션 수명에 종속).
 *  - 또한 사용자가 MAIN 이 아닌 다른 DB 트랜잭션 중이면 factory 의 교차-DB 차단에 걸려
 *    매 쿼리마다 throw 가 발생한다.
 *  - provider 를 직접 호출하면 txStore 영향권 밖에서 별도 커넥션으로 INSERT 되며,
 *    factory↔logger 재귀도 원천적으로 발생하지 않는다.
 *
 * STATUS 결정:
 *  - `errorDesc` 가 있으면 'FAIL', 없으면 'OK'. 호출자는 outcome 별 분기 없이
 *    같은 함수에 같은 필드 셋을 넘기면 된다.
 */

import { getRequestCtx } from '@/lib/utils/server/requestContext'
import { resolveFromEnv, type EnvResolveResult } from './resolvers/env'
import { getProvider } from './providers'
import type { IDbProvider } from './types'

/**
 * 로그 적재 대상은 항상 'MAIN' 으로 고정이고 env 는 프로세스 부팅 후 불변이므로
 * provider/dsn/pool 해석 결과를 모듈 스코프에 1회만 캐싱한다.
 * 매 쿼리마다 호출되는 hot path 에서 resolveFromEnv + getProvider 비용을 제거한다.
 * env 미설정 시에는 캐싱하지 않아 추후 호출에서 재시도 가능하게 둔다.
 */
type LogTarget = { provider: IDbProvider } & EnvResolveResult
let logTarget: LogTarget | null = null

function getLogTarget(): LogTarget | null {
  if (logTarget) return logTarget
  const env = resolveFromEnv('MAIN')
  if (!env) return null
  logTarget = { provider: getProvider(env.providerName), ...env }
  return logTarget
}

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

/**
 * 쿼리 이력 1건 적재. 호출자는 `void insertLogQuery(...)` 형태로 fire-and-forget 호출한다.
 * provider 를 직접 호출하여 factory 의 txStore 영향권 밖에서 실행된다.
 */
export async function insertLogQuery(fields: LogInfo): Promise<void> {
  try {
    // 사용자 컨텍스트는 logger 가 직접 조회 — factory 는 쿼리 메타만 넘기면 된다.
    const reqCtx = await getRequestCtx()

    const target = getLogTarget()
    if (!target) return

    await target.provider.execute(
      'MAIN',
      target.dsn,
      target.pool,
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
      {}
    )

  } catch (err) {
    // 로그 INSERT 실패는 절대 비즈니스 흐름을 막지 않는다. stdout 으로만 남기고 무시.
    console.warn('[db.log.insert.failed]', err)
  }
}

/** SQL preview — 앞 200자, 줄바꿈/공백 정규화. */
// export function sqlPreview(sql: string, max = 200): string {
//   const flat = sql.replace(/\s+/g, ' ').trim()
//   return flat.length <= max ? flat : flat.slice(0, max) + '…'
// }