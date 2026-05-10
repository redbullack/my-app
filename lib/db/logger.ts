/**
 * @module lib/db/logger
 * @description
 * DB 레이어 전용 구조화 로거. 인터페이스를 통해 후일 pino/winston/OTel 로 무중단 교체 가능.
 *
 * 운영 전환 시점에는 `setDbLogger()` 로 Oracle 로그 테이블 insert 구현체 등으로 교체한다.
 * 단, 그 구현체는 `getDb()` / `withLifecycle` 을 경유해서는 안 된다(무한 재귀).
 * 대신 `getSysDb()` 를 사용한다 — withLifecycle 을 우회하므로 로거가 자기 자신을
 * 다시 로깅하는 재귀가 발생하지 않는다.
 */

export interface DbLogger {
  info(event: string, fields: Record<string, unknown>): void
  warn(event: string, fields: Record<string, unknown>): void
  error(event: string, fields: Record<string, unknown>): void
}

/** 한 줄 JSON 형태로 stdout/stderr 에 출력하는 기본 구현. */
class ConsoleDbLogger implements DbLogger {
  info(event: string, fields: Record<string, unknown>): void {
    this.write('info', event, fields)
  }
  warn(event: string, fields: Record<string, unknown>): void {
    this.write('warn', event, fields)
  }
  error(event: string, fields: Record<string, unknown>): void {
    this.write('error', event, fields)
  }

  private write(level: 'info' | 'warn' | 'error', event: string, fields: Record<string, unknown>) {
    // loggedAt: 로거가 실제로 라인을 출력한 시각.
    // 비동기 INSERT 구현체에서는 INSERT 시점이 늦어질 수 있으므로
    // 쿼리의 진짜 시작/끝 시각은 fields.startedAt / fields.endedAt 으로 별도 보존된다.
    const line = JSON.stringify({
      loggedAt: new Date().toISOString(),
      level,
      scope: 'db',
      event,
      ...fields,
    })
    if (level === 'error') console.error(line)
    else if (level === 'warn') console.warn(line)
    else console.log(line)
  }
}

/**
 * 운영 환경용 Oracle DB 로그 테이블 기록 구현체.
 *
 * 사용법:
 *  - 앱 부트 시점(예: instrumentation.ts)에 아래처럼 교체한다.
 *      import { setDbLogger, OracleDbLogger } from '@/lib/db/logger'  // 주석 해제 후 export 추가
 *      setDbLogger(new OracleDbLogger('LOG'))   // 인자: DB_CONNECTION__<NAME> 식별자
 *
 * 설계 포인트:
 *  - `getSysDb(name)` 을 사용한다. getSysDb 는 withLifecycle 을 우회하므로
 *    "로거가 자기 자신을 로깅" 하는 무한 재귀가 원천적으로 발생하지 않는다.
 *  - getSysDb 가 사용하는 풀은 factory 와 provider 캐시를 공유하므로,
 *    로그 전용 별도 DB 를 쓰고 싶다면 환경변수 키를 분리하면 된다(예: DB_CONNECTION__LOG).
 *  - insert 실패는 console.warn 으로만 남기고 원래 흐름에 영향을 주지 않는다.
 *    (로그 INSERT 실패가 비즈니스 로직을 깨면 안 된다.)
 *  - info/warn/error 가 동기 인터페이스인 이유는 호출자(withLifecycle) 가 await 하지 않도록
 *    하기 위함이다. 내부적으로 fire-and-forget 비동기 INSERT 를 수행한다.
 *  - 콘솔 로그는 운영 전환 후 ConsoleDbLogger 대신 이 구현체로 교체하면 불필요해진다.
 */
// import { getSysDb } from './factory'
// import type { ISysDbClient } from './types'
//
// export class OracleDbLogger implements DbLogger {
//   private readonly db: ISysDbClient
//
//   constructor(dbName = 'LOG') {
//     // getSysDb 는 withLifecycle 우회 + tx 미지원 → 재귀/순환 의존 차단.
//     this.db = getSysDb(dbName)
//   }
//
//   info(event: string, fields: Record<string, unknown>): void {
//     void this.#insert('INFO', event, fields)
//   }
//   warn(event: string, fields: Record<string, unknown>): void {
//     void this.#insert('WARN', event, fields)
//   }
//   error(event: string, fields: Record<string, unknown>): void {
//     void this.#insert('ERROR', event, fields)
//   }
//
//   async #insert(level: string, event: string, fields: Record<string, unknown>): Promise<void> {
//     try {
//       await this.db.execute(
//         `INSERT INTO OWNER.MY_LOG_TABLE
//           (TRACE_ID, PARENT_TRACE_ID, ACTION_TRACE_ID,
//            DB_NAME, PROVIDER, OP, SQL_PREVIEW,
//            STATUS, STARTED_AT, ENDED_AT, DURATION_MS, ROW_COUNT,
//            ACTION_NAME, PAGE_PATH, USER_ID, USER_NAME, ROLE, EMPNO,
//            ERROR_CATEGORY, ERROR_CODE, ERROR_MSG,
//            LOG_LEVEL, EVENT, CREATED_AT)
//          VALUES
//           (:traceId, :parentTraceId, :actionTraceId,
//            :dbName, :provider, :op, :sqlPreview,
//            :status, :startedAt, :endedAt, :durationMs, :rowCount,
//            :actionName, :pagePath, :userId, :userName, :role, :empno,
//            :errorCategory, :errorCode, :errorMsg,
//            :level, :event, SYSDATE)`,
//         {
//           traceId:        fields.traceId        ?? null,
//           parentTraceId:  fields.parentTraceId  ?? null,
//           actionTraceId:  fields.actionTraceId  ?? null,
//           dbName:         fields.db             ?? null,
//           provider:       fields.provider       ?? null,
//           op:             fields.op             ?? null,
//           sqlPreview:     typeof fields.sql === 'string' ? sqlPreview(fields.sql) : null,
//           status:         event === 'db.ok' ? 'OK' : 'ERR',
//           startedAt:      fields.startedAt      ?? null,
//           endedAt:        fields.endedAt        ?? null,
//           durationMs:     fields.durationMs     ?? null,
//           rowCount:       fields.rowCount       ?? null,
//           actionName:     fields.actionName     ?? null,
//           pagePath:       fields.pagePath       ?? null,
//           userId:         fields.userId         ?? null,
//           userName:       fields.userName       ?? null,
//           role:           fields.role           ?? null,
//           empno:          fields.empno          ?? null,
//           errorCategory:  fields.category       ?? null,
//           errorCode:      fields.code           ?? null,
//           errorMsg:       fields.devMessage ?? fields.cause ?? null,
//           level,
//           event,
//         },
//       )
//     } catch (logErr) {
//       // 로그 INSERT 실패는 절대 비즈니스 흐름을 막지 않는다.
//       // stdout 으로만 떨어뜨리고 무시.
//       console.warn('[db.log.insert.failed]', logErr)
//     }
//   }
// }

/** 모듈 단일 로거 인스턴스. 교체가 필요하면 setDbLogger() 사용. */
let logger: DbLogger = new ConsoleDbLogger()

export function getDbLogger(): DbLogger {
  return logger
}

export function setDbLogger(next: DbLogger): void {
  logger = next
}

/** SQL preview — 앞 80 자, 줄바꿈/공백 정규화. */
export function sqlPreview(sql: string, max = 80): string {
  const flat = sql.replace(/\s+/g, ' ').trim()
  return flat.length <= max ? flat : flat.slice(0, max) + '…'
}

/**
 * bind 의 키 목록만 추출. 값은 노출하지 않음.
 * 배열 바인드는 길이만 리턴.
 */
export function bindShape(binds: unknown): unknown {
  if (binds == null) return null
  if (Array.isArray(binds)) return { positional: binds.length }
  if (typeof binds === 'object') return { keys: Object.keys(binds as object) }
  return null
}
