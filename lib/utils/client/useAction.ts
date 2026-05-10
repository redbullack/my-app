/**
 * @module lib/utils/client/useAction
 * @description
 * 이벤트 핸들러용 Server Action 실행 훅.
 *
 * 팀원 규칙:
 *  - try/catch 금지. execute() 내부에서 envelope 자동 언래핑 + 실패 시 전역 핸들러 호출.
 *  - onSuccess 로 정상 경로만 기술.
 *  - onError 에서 'handled' 반환 시 전역 토스트 스킵 (자체 처리).
 *
 * @example
 * const { execute, isLoading } = useAction()
 * const onClick = () =>
 *   execute(() => updateEmp(rows), {
 *     onSuccess: ({ updated }) => toast(`${updated}건 수정 완료`, { variant: 'success' }),
 *   })
 */
import { useCallback, useState } from 'react'
import { AppError, type ActionResponse } from '../type'
import { handleGlobalError } from './globalErrorHandler'

/**
 * Next.js 의 redirect() 가 던지는 NEXT_REDIRECT 에러인지 판별.
 *
 * Server Action 안에서 redirect() 가 호출되면 message="NEXT_REDIRECT" + digest=`NEXT_REDIRECT;...`
 * 형태의 에러가 클라이언트로 reject 된다. 이 케이스는 "에러" 가 아니라 정상적인 네비게이션이므로
 * 토스트/전역 에러 핸들러로 빠지면 안 된다 (Next 런타임이 별도로 페이지 이동을 처리한다).
 *
 * digest 우선 체크 — message 만 체크하면 사용자가 우연히 같은 문자열을 던지는 경우와 충돌.
 */
function isNextRedirectError(err: unknown): boolean {
    if (err == null || typeof err !== 'object') return false
    const digest = (err as { digest?: unknown }).digest
    if (typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')) return true
    const message = (err as { message?: unknown }).message
    return message === 'NEXT_REDIRECT'
}

interface ExecuteOptions<T> {
    onSuccess?: (data: T) => void
    /** 반환값이 'handled' 면 전역 에러 핸들러 호출을 스킵한다. */
    onError?: (error: AppError) => 'handled' | void
    /** true 면 실패 시 전역 토스트를 띄우지 않는다. */
    silent?: boolean
    /** true 면 실패 시 가장 가까운 error.tsx(Error Boundary)로 throw 한다. */
    throwToBoundary?: boolean
}

export function useAction() {
    const [isLoading, setIsLoading] = useState(false)
    const [, setBoundaryError] = useState<unknown>(null)

    const execute = useCallback(
        <T>(
            factory: () => Promise<ActionResponse<T>>,
            opts: ExecuteOptions<T> = {},
        ): void => {
            ;(async () => {
                setIsLoading(true)
                try {
                    const result = await factory()
                    if (result.isSuccess) {
                        opts.onSuccess?.(result.data)
                        return
                    }
                    const appError = new AppError(result.error)
                    const handled = opts.onError?.(appError)
                    if (handled === 'handled' || opts.silent) return
                    if (opts.throwToBoundary) {
                        setBoundaryError(() => { throw appError })
                        return
                    }
                    handleGlobalError(appError)
                } catch (err: unknown) {
                    // redirect() 는 에러가 아니라 정상 네비게이션 — Next 런타임이 처리하도록
                    // rethrow 하고 토스트/onError 로 빠지지 않게 한다.
                    if (isNextRedirectError(err)) throw err
                    if (opts.silent) return
                    if (opts.throwToBoundary) {
                        setBoundaryError(() => { throw err })
                        return
                    }
                    handleGlobalError(
                        err instanceof Error ? err : new Error('알 수 없는 오류'),
                    )
                } finally {
                    setIsLoading(false)
                }
            })()
        },
        [],
    )

    return { execute, isLoading }
}
