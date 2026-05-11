/**
 * @module lib/db/errors
 * @description
 * DB 레이어 표준 에러. provider raw 에러는 모두 이 클래스로 wrapping 되어
 * 호출자(서버 액션)에게 전파된다.
 *
 * 핵심 원칙:
 *  - `.message` 는 항상 사용자 안전 문구 → 클라이언트에 노출되어도 무방
 *  - `category / code / traceId / cause` 는 서버 로그용 디버깅 메타데이터
 *  - 호출자는 `error instanceof DbError` 로 분기 가능
 */

import { randomUUID } from 'node:crypto'

export type DbErrorCategory =
  | 'config'      // 레지스트리/암호키 등 설정 문제
  | 'connection'  // 네트워크/리스너/호스트 등 접속 실패
  | 'timeout'     // 쿼리 타임아웃
  | 'syntax'      // SQL 구문/객체 미존재
  | 'constraint'  // PK/UNIQUE/FK/CHECK 위반
  | 'permission'  // 권한/인증 실패
  | 'auth'        // 인증되지 않은 컨텍스트에서 DB 호출 시도 (factory 게이트에서 차단)
  | 'transaction' // tx 사용 규약 위반 (중첩 tx, 교차 DB 호출, abort/closing 이후 호출, await 누락 등)
  | 'unknown'     // 분류 불가

/** 클라이언트에 노출될 단일 안전 문구. */
export const SAFE_PUBLIC_MESSAGE = '데이터베이스 처리 중 오류가 발생했습니다.'

export interface DbErrorInit {
  category: DbErrorCategory
  /** provider 네이티브 에러 코드 (예: 'ORA-00942') */
  code?: string
  /** 로그 상관관계용. 미지정 시 자동 생성. */
  traceId?: string
  /** 원본 에러 (서버 로그 전용, 클라이언트 노출 금지) */
  cause?: unknown
  /** override 가능한 사용자 노출 메시지. 미지정 시 SAFE_PUBLIC_MESSAGE 사용. */
  publicMessage?: string
  /** 서버 로그용 상세 메시지 (개발자 친화적). */
  devMessage?: string
}

export class DbError extends Error {
  readonly category: DbErrorCategory
  readonly code?: string
  readonly traceId: string
  readonly devMessage?: string
  // Error.cause 는 ES2022 표준 필드. tsconfig target 이 충분하면 생략 가능하나 명시.
  readonly cause?: unknown

  constructor(init: DbErrorInit) {
    super(init.publicMessage ?? SAFE_PUBLIC_MESSAGE)
    this.name = 'DbError'
    this.category = init.category
    this.code = init.code
    this.traceId = init.traceId ?? randomUUID()
    this.devMessage = init.devMessage
    this.cause = init.cause
  }
}

/**
 * Oracle 에러 객체에서 카테고리/코드를 추출.
 * oracledb 는 에러에 `errorNum` (number) 또는 `message` 에 'ORA-XXXXX' prefix 를 담는다.
 */
export function categorizeOracleError(err: unknown): {
  category: DbErrorCategory
  code?: string
} {
  const e = err as { errorNum?: number; message?: string } | null
  if (!e) return { category: 'unknown' }

  const num =
    typeof e.errorNum === 'number'
      ? e.errorNum
      : matchOraNumber(e.message ?? '')

  const code = num !== undefined ? `ORA-${String(num).padStart(5, '0')}` : undefined

  // 매핑 — 자주 마주치는 코드만. 나머지는 'unknown'.
  switch (num) {
    // constraint 위반
    case 1:     // unique
    case 2290:  // check
    case 2291:  // FK parent not found
    case 2292:  // FK child exists
    case 1400:  // not null
      return { category: 'constraint', code }

    // syntax / object missing
    case 900:   // invalid SQL statement
    case 904:   // invalid identifier
    case 942:   // table or view does not exist
    case 936:   // missing expression
    case 933:   // SQL command not properly ended
      return { category: 'syntax', code }

    // permission
    case 1017:  // invalid username/password
    case 1031:  // insufficient privileges
      return { category: 'permission', code }

    // connection
    case 12541: // no listener
    case 12545: // host unavailable
    case 12154: // TNS could not resolve
    case 3113:  // end-of-file on communication channel
    case 3114:  // not connected
      return { category: 'connection', code }

    // timeout / cancel
    case 1013:  // user requested cancel
      return { category: 'timeout', code }

    default:
      return { category: 'unknown', code }
  }
}

function matchOraNumber(msg: string): number | undefined {
  const m = /ORA-(\d{4,5})/.exec(msg)
  return m ? Number(m[1]) : undefined
}

/**
 * PostgreSQL 에러 객체에서 카테고리/코드를 추출.
 *
 * pg 드라이버는 서버에서 던진 에러에 5자리 SQLSTATE 를 `.code` 로 담아준다
 * (예: '23505' unique_violation). 네트워크/소켓 단계 에러는 SQLSTATE 가 아닌
 * Node 의 errno 문자열(ECONNREFUSED 등) 이 같은 `.code` 필드에 들어오므로 함께 처리한다.
 *
 * SQLSTATE 분류 기준은 PostgreSQL 매뉴얼 Appendix A 의 클래스 코드를 따른다:
 *   - 08: connection_exception
 *   - 23: integrity_constraint_violation
 *   - 28: invalid_authorization_specification
 *   - 42: syntax_error_or_access_rule_violation (단 42501 은 권한)
 *   - 53: insufficient_resources
 *   - 57014: query_canceled  (statement_timeout 발동 시)
 */
export function categorizePostgresError(err: unknown): {
  category: DbErrorCategory
  code?: string
} {
  const e = err as { code?: string; message?: string } | null
  if (!e) return { category: 'unknown' }

  const code = typeof e.code === 'string' ? e.code : undefined
  if (!code) return { category: 'unknown' }

  // Node 네트워크 errno — pg 가 접속 단계 실패 시 그대로 노출.
  if (
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'EHOSTUNREACH' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'EPIPE'
  ) {
    return { category: 'connection', code }
  }

  // 명시적 timeout / cancel
  if (code === '57014') return { category: 'timeout', code } // query_canceled

  // 권한: 일반적인 syntax 클래스(42) 안에 있지만 의미는 권한이라 먼저 분기.
  if (code === '42501') return { category: 'permission', code } // insufficient_privilege

  const cls = code.slice(0, 2)
  switch (cls) {
    case '08': // connection_exception
      return { category: 'connection', code }
    case '23': // integrity_constraint_violation
      return { category: 'constraint', code }
    case '28': // invalid_authorization_specification (28000, 28P01 등)
      return { category: 'permission', code }
    case '42': // syntax_error_or_access_rule_violation (42501 은 위에서 처리됨)
      return { category: 'syntax', code }
    case '53': // insufficient_resources — 풀 고갈/메모리/디스크. 운영 관점에서 connection 으로 묶음.
      return { category: 'connection', code }
    case '3D': // invalid_catalog_name
    case '3F': // invalid_schema_name
      return { category: 'syntax', code }
    default:
      return { category: 'unknown', code }
  }
}

/**
 * SQL Server(mssql 드라이버) 에러 객체에서 카테고리/코드를 추출.
 *
 * mssql 은 에러에 다음 두 종류의 식별자를 채워준다:
 *   - `.number` : SQL Server 가 보낸 native 에러 번호 (예: 2627 unique violation).
 *   - `.code`   : 드라이버 단계 분류 문자열 (예: 'ELOGIN', 'ETIMEOUT', 'ESOCKET').
 *
 * native error number 매핑은 SQL Server 의 sys.messages 기준이며,
 * 자주 마주치는 코드만 분류한다. 나머지는 'unknown'.
 */
export function categorizeMssqlError(err: unknown): {
  category: DbErrorCategory
  code?: string
} {
  const e = err as { number?: number; code?: string; message?: string } | null
  if (!e) return { category: 'unknown' }

  const driverCode = typeof e.code === 'string' ? e.code : undefined

  // 1) 드라이버 단계 코드 — native number 가 채워지기 전 단계의 실패들.
  if (driverCode) {
    switch (driverCode) {
      case 'ELOGIN':           // 로그인 실패
        return { category: 'permission', code: driverCode }
      case 'ETIMEOUT':         // 쿼리/연결 타임아웃
      case 'ERequestPending':
        return { category: 'timeout', code: driverCode }
      case 'ECONNCLOSED':
      case 'ESOCKET':
      case 'ENOTOPEN':
      case 'ECONNRESET':
      case 'ECONNREFUSED':
      case 'EINSTLOOKUP':      // SQL Browser 로 instance lookup 실패
      case 'ENOTFOUND':
        return { category: 'connection', code: driverCode }
    }
  }

  const num = typeof e.number === 'number' ? e.number : undefined
  const code = num !== undefined ? `MSSQL-${num}` : driverCode

  // 2) SQL Server native error number 매핑.
  switch (num) {
    // constraint 위반
    case 2627:   // unique constraint
    case 2601:   // unique index
    case 547:    // FK / CHECK constraint
    case 515:    // NOT NULL
      return { category: 'constraint', code }

    // syntax / object missing
    case 102:    // 일반 syntax
    case 103:    // 식별자 too long
    case 156:    // keyword 근처 syntax
    case 207:    // invalid column name
    case 208:    // invalid object name (테이블/뷰 없음)
    case 4104:   // multi-part identifier could not be bound
    case 8152:   // truncation (구버전에서 syntax 분류로 보내는 편이 디버깅 단서가 됨)
      return { category: 'syntax', code }

    // permission / auth
    case 229:    // permission denied on object
    case 230:    // permission denied on column
    case 262:    // permission denied (statement-level)
    case 916:    // db access denied
    case 18456:  // login failed
      return { category: 'permission', code }

    // connection
    case 233:    // pre-login handshake 실패
    case 4060:   // cannot open database
    case 10054:  // existing connection forcibly closed
    case 10060:  // connection attempt failed
    case 10061:  // no connection — actively refused
    case 40197:  // azure: transient
    case 40501:  // azure: server busy
    case 40613:  // azure: db unavailable
      return { category: 'connection', code }

    // timeout / cancel / deadlock
    case 1205:   // deadlock victim — 운영 관점 retry 대상이라 timeout 으로 묶음
    case -2:     // 일부 환경에서 number=-2 로 driver timeout 노출
      return { category: 'timeout', code }

    default:
      return { category: 'unknown', code }
  }
}
