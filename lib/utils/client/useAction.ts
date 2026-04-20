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
        async <T>(
            factory: () => Promise<ActionResponse<T>>,
            opts: ExecuteOptions<T> = {},
        ): Promise<void> => {
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
        },
        [],
    )

    return { execute, isLoading }
}
