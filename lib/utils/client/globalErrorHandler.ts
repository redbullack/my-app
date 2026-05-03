/**
 * @module lib/utils/client/globalErrorHandler
 * @description
 * AppError 또는 일반 Error를 받아 분류에 따라 Toast를 띄우는 단일 진입점.
 * 팀원은 직접 이 함수를 호출하지 않는다 —
 * useAction 또는 Grid/Input의 envelope 언래핑 로직이 실패 시 자동으로 호출한다.
 *
 * useAction이 ActionError(plain object) → AppError(class)로 복원한 뒤 넘기므로,
 * 이 함수는 AppError와 일반 Error만 처리하면 된다.
 */
import { toast, type ToastVariant } from '@/components/control/Toast'
import { AppError, type ErrorType } from '../type'

const VARIANT_BY_TYPE: Record<ErrorType, ToastVariant> = {
    validation: 'warning',
    db_constraint: 'warning',
    db_permission: 'warning',
    busy: 'warning',
    auth: 'error',
    network: 'error',
    timeout: 'error',
    db_system: 'error',
    unknown: 'error',
}

const TITLE_BY_TYPE: Record<ErrorType, string | undefined> = {
    validation: '입력 확인',
    db_constraint: '입력 확인',
    db_permission: '권한 확인',
    busy: '요청 제한 초과',
    auth: '인증 필요',
    network: '네트워크 오류',
    timeout: '요청 시간 초과',
    db_system: '시스템 오류',
    unknown: '오류',
}

/**
 * AppError 또는 일반 Error를 받아 UI 피드백을 출력한다.
 * - AppError: 카테고리별 variant/title/traceId 표시
 * - 일반 Error: 'unknown' 기본 분기
 */
export function handleGlobalError(error: AppError | Error | unknown): void {
    console.log(`CLIENT: 여기는 handleGlobalError 입니다. isError: ${error instanceof Error}, error: ${error}`)
    if (error instanceof AppError) {
        console.log(`CLIENT: 여기는 AppError 입니다. error.message: ${error.message}`)
        toast(error.message, {
            variant: VARIANT_BY_TYPE[error.type],
            title: TITLE_BY_TYPE[error.type],
            traceId: error.traceId,
        })
        if (error.devMessage && process.env.NODE_ENV === 'development') {
            console.error(
                `[AppError:${error.type}] ${error.traceId} — ${error.devMessage}`,
            )
        }
        return
    }

    const message = error instanceof Error ? error.message : String(error)
    console.error('[Global Error Logger]:', error)
    toast(message || '처리 중 오류가 발생했습니다.', {
        variant: 'error',
        title: TITLE_BY_TYPE.unknown,
    })
}
