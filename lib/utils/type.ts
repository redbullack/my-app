/**
 * @module lib/utils/type
 * @description
 * 에러 프레임워크의 핵심 타입.
 * Server Action → Client 사이의 계약은 `ActionResponse<T>` envelope 하나로 통일된다.
 *
 * AppError (class, extends Error):
 *   클라이언트에서 instanceof 체크 및 Error Boundary 전파에 사용.
 *
 * ActionError (interface, plain object):
 *   Server Action 직렬화 경계에서 사용. ActionResponse envelope에 포함.
 *   클라이언트에서 `new AppError(serialized)` 로 class 인스턴스로 복원 가능.
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

/** Server Action 직렬화 경계용 plain object 타입 */
export interface ActionError {
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

/**
 * 클라이언트 에러 클래스. Error를 상속하여 Error Boundary 전파 및 instanceof 체크가 가능하다.
 * ActionError(Server Action 응답)로부터 `new AppError(serialized)` 로 복원한다.
 */
export class AppError extends Error {
    readonly type: ErrorType
    readonly code?: string
    readonly traceId: string
    readonly devMessage?: string

    constructor(init: ActionError) {
        super(init.message)
        this.name = 'AppError'
        this.type = init.type
        this.code = init.code
        this.traceId = init.traceId
        this.devMessage = init.devMessage
    }
}

export type ActionResponse<T> =
    | { isSuccess: true; data: T; error?: never }
    | { isSuccess: false; data?: never; error: ActionError }
