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
 *
 * 설계 포인트 (db.ts 와의 상호작용):
 *  1) **풀 재사용** — db.ts 의 `getPool('MAIN')` 으로 동일 풀을 빌린다 (내부 Map 캐시 히트).
 *     별도 풀을 만들지 않아 커넥션 한도 / Thick 모드 초기화 / HMR 캐시를 모두 공유한다.
 *  2) **트랜잭션 비격리** — `providerOp.getConnection()` 으로 풀에서 자기 커넥션을 직접 빌린다.
 *     사용자가 `db.runTx(...)` 안에서 쥐고 있는 커넥션과는 별개라, 로그 INSERT 가 사용자
 *     트랜잭션에 enlist 되지 않고 rollback 영향을 받지 않는다.
 *  3) **중복 로깅 차단** — `createDbAgent` (= run/runTx 가 만드는 agent) 를 거치지 않고
 *     `providerOp.rawExecute` 를 직접 호출한다. agent 의 fill/execute 가 내부에서
 *     `insertLogQuery` 를 다시 호출하므로 우회하지 않으면 무한 재귀가 된다.
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import { getDb } from "./db-new2"

/** factory(db.ts) 가 넘기는 쿼리 메타. 사용자 컨텍스트는 본 모듈이 직접 조회한다. */
export interface LogInfo {
  db?: string
  provider?: string
  op?: string
  sql?: string
  binds?: string
  startedAt?: Date
  endedAt?: Date
  rowCount?: number
  /** 있으면 STATUS='FAIL', 없으면 'OK'. `util.inspect(err, ...)` 결과 그대로. */
  errorDesc?: string
  userId?: string
  userName?: string
  role?: string
  empno?: string
}

const logSkipALS = new AsyncLocalStorage<boolean>()
export const isLogSkip = ():boolean => logSkipALS.getStore() === true

/**
 * 쿼리 이력 1건 적재. `void insertLogQuery(...)` 로 호출.
 * agent 의 로깅 경로를 우회하기 위해 providerOp.rawExecute 를 직접 호출한다.
 */
export async function insertLogQuery(fields: LogInfo): Promise<void> {
  try {
    await logSkipALS.run(true, async () =>{
        await getDb({ name: 'MAIN', isUserLess: true }).run(async (client) => {
            await client.execute(
                `INSERT INTO SCOTT.NEXT_TEST_LOG_QUERY
                    (DB_NAME, PROVIDER, OP, SQL_PREVIEW, BINDS,
                    STATUS, STARTED_AT, ENDED_AT, ROW_COUNT,
                    PAGE_PATH, USER_ID, USER_NAME, ROLE, EMPNO,
                    ERROR_DESC, CREATED_AT)
                    VALUES
                    (:dbName, :provider, :op, :sql, :binds,
                    :status, :startedAt, :endedAt, :rowCount,
                    :pagePath, :userId, :userName, :role, :empno,
                    :errorDesc, SYSDATE)`,
                    {
                        dbName:    fields.db        ?? null,
                        provider:  fields.provider  ?? null,
                        op:        fields.op        ?? null,
                        sql:       typeof fields.sql === 'string' ? fields.sql : null,
                        binds:     fields.binds     ?? null,
                        status:    fields.errorDesc ? 'FAIL' : 'OK',
                        startedAt: fields.startedAt ?? null,
                        endedAt:   fields.endedAt   ?? null,
                        rowCount:  fields.rowCount  ?? null,
                        pagePath:  null,
                        userId:    fields.userId    ?? null,
                        userName:  fields.userName  ?? null,
                        role:      fields.role      ?? null,
                        empno:     fields.empno     ?? null,
                        errorDesc: fields.errorDesc ?? null,
                    },
            )
        })
    })
  } catch (err) {
    console.warn('[db.log.insert.failed]', err)
  }
}
