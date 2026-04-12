/**
 * @module lib/hooks/useErrorHandler
 * @description
 * 이벤트 핸들러 · async 코드에서 발생한 에러를 가장 가까운 React Error Boundary
 * (Next.js의 error.tsx)로 전파하는 훅.
 *
 * React Error Boundary는 렌더링 중 에러만 자동 캐치한다.
 * onClick, onSubmit, fetch 등 비-렌더링 코드의 에러는 수동으로 전파해야 한다.
 * 이 훅은 `setState` 내부에서 throw 하는 패턴으로 이를 해결한다.
 *
 * 사용 예)
 *   const { throwError } = useErrorHandler()
 *
 *   async function handleClick() {
 *     try {
 *       await fetchSomething()
 *     } catch (err) {
 *       throwError(err)  // → 가장 가까운 error.tsx 로 전파
 *     }
 *   }
 */
'use client'

import { useState, useCallback } from 'react'
import { ClientError, categorizeError } from '@/lib/errors/client-errors'
import { getClientLogger } from '@/lib/errors/client-logger'

export function useErrorHandler() {
  const [, setState] = useState()

  const throwError = useCallback((err: unknown) => {
    const clientError =
      err instanceof ClientError
        ? err
        : new ClientError({
            category: categorizeError(err),
            cause: err,
            devMessage: err instanceof Error ? err.message : String(err),
          })

    getClientLogger().error('client.error', {
      category: clientError.category,
      code: clientError.code,
      traceId: clientError.traceId,
      devMessage: clientError.devMessage,
    })

    // setState 콜백 내에서 throw → React가 가장 가까운 Error Boundary로 전파
    setState(() => {
      throw clientError
    })
  }, [])

  return { throwError }
}
