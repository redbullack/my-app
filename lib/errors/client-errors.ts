/**
 * @module lib/errors/client-errors
 * @description
 * 클라이언트 레이어 표준 에러. 서버의 DbError(lib/db/errors.ts)와 동일한 설계 철학을 따른다.
 *
 * 핵심 원칙:
 *  - `.message` 는 항상 사용자 안전 문구 → UI에 노출되어도 무방
 *  - `category / code / traceId / devMessage / cause` 는 로그용 디버깅 메타데이터
 *  - 호출자는 `error instanceof ClientError` 로 분기 가능
 *  - 브라우저 환경 전용: `crypto.randomUUID()` 사용 (node:crypto 미사용)
 */

export type ClientErrorCategory =
  | 'network'     // fetch 실패, 오프라인, CORS, 5xx 응답
  | 'validation'  // 폼/입력 유효성 검사 실패
  | 'render'      // React 렌더링 에러 (Error Boundary 경유)
  | 'auth'        // 401/403, 세션 만료
  | 'timeout'     // AbortController 타임아웃, 느린 응답
  | 'unknown'     // 분류 불가

/** UI에 노출될 단일 안전 문구. */
export const SAFE_CLIENT_MESSAGE = '처리 중 오류가 발생했습니다.'

export interface ClientErrorInit {
  category: ClientErrorCategory
  /** 에러 코드 (예: 'HTTP_500', 'ABORT_TIMEOUT') */
  code?: string
  /** 로그 상관관계용. 미지정 시 자동 생성. */
  traceId?: string
  /** 원본 에러 */
  cause?: unknown
  /** override 가능한 사용자 노출 메시지. 미지정 시 SAFE_CLIENT_MESSAGE 사용. */
  publicMessage?: string
  /** 로그용 상세 메시지 (개발자 친화적). */
  devMessage?: string
}

export class ClientError extends Error {
  readonly category: ClientErrorCategory
  readonly code?: string
  readonly traceId: string
  readonly devMessage?: string
  readonly cause?: unknown

  constructor(init: ClientErrorInit) {
    super(init.publicMessage ?? SAFE_CLIENT_MESSAGE)
    this.name = 'ClientError'
    this.category = init.category
    this.code = init.code
    this.traceId = init.traceId ?? crypto.randomUUID()
    this.devMessage = init.devMessage
    this.cause = init.cause
  }
}

/**
 * HTTP 응답 상태코드 → ClientErrorCategory 매핑.
 * fetch 후 response.ok === false 일 때 사용.
 */
export function categorizeResponse(status: number): ClientErrorCategory {
  if (status === 401 || status === 403) return 'auth'
  if (status === 408 || status === 504) return 'timeout'
  if (status === 422) return 'validation'
  if (status >= 500) return 'network'
  return 'unknown'
}

/**
 * 미지의 에러 객체에서 카테고리를 추론.
 * - TypeError (fetch 실패 시 브라우저가 던지는 타입) → network
 * - AbortError (AbortController) → timeout
 * - ClientError → 이미 분류됨, 그대로 반환
 */
export function categorizeError(err: unknown): ClientErrorCategory {
  if (err instanceof ClientError) return err.category

  if (err instanceof DOMException && err.name === 'AbortError') return 'timeout'
  if (err instanceof TypeError) return 'network'

  return 'unknown'
}
