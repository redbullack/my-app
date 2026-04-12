/**
 * @pattern Error Boundary
 * @description
 * 전역 에러 바운더리. 렌더링 중 발생한 에러를 캐치하여 폴백 UI를 표시한다.
 * error.tsx는 반드시 'use client'를 선언해야 한다 (Error Boundary는 클라이언트에서만 동작).
 *
 * props:
 * - error: 발생한 에러 객체
 * - reset: 에러 상태를 초기화하고 리렌더링을 시도하는 함수
 */
'use client'

import { useEffect } from 'react'
import { Button, Panel, Badge } from '@/components/control'
import { ClientError } from '@/lib/errors/client-errors'
import { getClientLogger } from '@/lib/errors/client-logger'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const isClientError = error instanceof ClientError

  useEffect(() => {
    if (isClientError) {
      getClientLogger().error('client.boundary', {
        category: (error as ClientError).category,
        traceId: (error as ClientError).traceId,
        devMessage: (error as ClientError).devMessage,
      })
    }
  }, [error, isClientError])

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Panel variant="outlined" className="max-w-md text-center">
        <h1 className="text-2xl font-bold text-error">오류가 발생했습니다</h1>
        {isClientError && (
          <div className="mt-2 flex items-center justify-center gap-2">
            <Badge variant="error">{(error as ClientError).category}</Badge>
            <span className="text-xs text-text-muted font-mono">
              {(error as ClientError).traceId.slice(0, 8)}
            </span>
          </div>
        )}
        <p className="mt-2 text-text-secondary">{error.message}</p>
        {error.digest && (
          <p className="mt-1 text-xs text-text-muted">Error digest: {error.digest}</p>
        )}
        <div className="mt-6">
          <Button variant="primary" onClick={reset}>
            다시 시도
          </Button>
        </div>
      </Panel>
    </div>
  )
}
