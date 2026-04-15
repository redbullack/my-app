/**
 * @module lib/utils/client/globalErrorHandler
 * @description
 * 실패한 ActionResponse.error 또는 일반 Error를 받아 AppError 분류에 따라
 * Toast를 띄우는 단일 진입점. 팀원은 직접 이 함수를 호출하지 않는다 —
 * useAction 또는 Grid/Input의 envelope 언래핑 로직이 실패 시 자동으로 호출한다.
 */
import { toast, type ToastVariant } from '@/components/control/Toast'
import type { AppError, ErrorType } from '../type'

const VARIANT_BY_TYPE: Record<ErrorType, ToastVariant> = {
    validation: 'warning',
    db_constraint: 'warning',
    db_permission: 'warning',
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
    auth: '인증 필요',
    network: '네트워크 오류',
    timeout: '요청 시간 초과',
    db_system: '시스템 오류',
    unknown: '오류',
}

function isAppError(err: unknown): err is AppError {
    return (
        typeof err === 'object' &&
        err !== null &&
        'type' in err &&
        'message' in err &&
        'traceId' in err
    )
}

/**
 * AppError 또는 일반 Error를 받아 UI 피드백을 출력한다.
 * - AppError: 카테고리별 variant/title/traceId 표시
 * - 일반 Error: 'unknown' 기본 분기
 */
export function handleGlobalError(error: AppError | Error | unknown): void {
    if (isAppError(error)) {
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
