/**
 * @module lib/utils/type
 * @description
 * 간소화된 에러 프레임워크의 핵심 타입.
 * Server Action → Client 사이의 계약은 `ActionResponse<T>` envelope 하나로 통일된다.
 */

/**
 * AppError 분류. UI 분기와 1:1 매칭된다:
 * - validation/db_constraint/db_permission → warning toast (사용자 입력 원인)
 * - auth → error toast (+ 추후 로그인 리다이렉트)
 * - network/timeout → error toast
 * - db_system → error toast + traceId 표시 (시스템 장애)
 * - unknown → error toast + traceId 표시
 */
export type ErrorType =
    | 'validation'
    | 'auth'
    | 'network'
    | 'timeout'
    | 'db_constraint'
    | 'db_permission'
    | 'db_system'
    | 'unknown'

export interface AppError {
    type: ErrorType
    /** 사용자에게 노출 가능한 안전 문구 */
    message: string
    /** provider 네이티브 코드 (예: 'ORA-00942') */
    code?: string
    /** 서버 로그와 1:1 매칭용 상관관계 ID */
    traceId: string
    /** dev 모드 상세 메시지 */
    devMessage?: string
}

export type ActionResponse<T> =
    | { isSuccess: true; data: T; error?: never }
    | { isSuccess: false; data?: never; error: AppError }
