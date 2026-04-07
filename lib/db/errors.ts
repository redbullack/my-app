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
  | 'connection' // 네트워크/리스너/호스트 등 접속 실패
  | 'timeout'    // 쿼리 타임아웃
  | 'syntax'     // SQL 구문/객체 미존재
  | 'constraint' // PK/UNIQUE/FK/CHECK 위반
  | 'permission' // 권한/인증 실패
  | 'unknown'    // 분류 불가

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
