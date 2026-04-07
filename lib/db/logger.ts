/**
 * @module lib/db/logger
 * @description
 * DB 레이어 전용 구조화 로거.
 * 인터페이스를 통해 후일 pino/winston/OTel 로 무중단 교체 가능.
 *
 * 보안 원칙:
 *  - **bind 값은 절대 로그에 기록하지 않는다** (PII/비밀번호 누출 방지).
 *  - dev 환경에서만 bind 의 *키 목록* 을 출력.
 *  - SQL 은 앞 80 자만 preview 로 남긴다.
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
    const line = JSON.stringify({
      ts: new Date().toISOString(),
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
 *      import { setDbLogger } from '@/lib/db/logger'
 *      import { OracleDbLogger } from '@/lib/db/logger'  // 주석 해제 후 export 추가
 *      setDbLogger(new OracleDbLogger())
 *
 * 주의:
 *  - OracleDbLogger 내부에서는 절대 getDb() / withLifecycle 을 경유하지 않는다.
 *    (무한 재귀 방지) provider 를 직접 호출하거나 node-oracledb 를 직접 사용한다.
 *  - insert 실패는 console.warn 으로만 남기고 원래 흐름에 영향을 주지 않는다.
 *  - 콘솔 로그는 운영 전환 후 ConsoleDbLogger 대신 이 구현체로 교체하면 불필요해진다.
 */
// class OracleDbLogger implements DbLogger {
//   // pool 은 별도 로그 전용 DB 커넥션 (getDb 를 거치지 않고 직접 생성)
//   // private pool: oracledb.Pool  ← 예시: 별도 초기화 필요
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
//       // const conn = await this.pool.getConnection()
//       // try {
//       //   await conn.execute(
//       //     `INSERT INTO OWNER.MY_LOG_TABLE
//       //       (TRACE_ID, DB_NAME, PROVIDER, OP, SQL_PREVIEW,
//       //        STATUS, DURATION_MS, ROW_COUNT,
//       //        ERROR_CATEGORY, ERROR_CODE, ERROR_MSG,
//       //        LOG_LEVEL, EVENT, CREATED_AT)
//       //      VALUES
//       //       (:traceId, :dbName, :provider, :op, :sqlPreview,
//       //        :status, :durationMs, :rowCount,
//       //        :errorCategory, :errorCode, :errorMsg,
//       //        :level, :event, SYSDATE)`,
//       //     {
//       //       traceId:       fields.traceId   ?? null,
//       //       dbName:        fields.db         ?? null,
//       //       provider:      fields.provider   ?? null,
//       //       op:            fields.op         ?? null,
//       //       sqlPreview:    fields.sql        ?? null,
//       //       status:        event === 'db.ok' ? 'OK' : 'ERR',
//       //       durationMs:    fields.durationMs ?? null,
//       //       rowCount:      fields.rowCount   ?? null,
//       //       errorCategory: fields.category   ?? null,
//       //       errorCode:     fields.code       ?? null,
//       //       errorMsg:      fields.devMessage ?? fields.cause ?? null,
//       //       level,
//       //       event,
//       //     },
//       //     { autoCommit: true },
//       //   )
//       // } finally {
//       //   await conn.close()
//       // }
//     } catch (logErr) {
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
