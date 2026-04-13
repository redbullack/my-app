/**
 * @route   /test-case
 * @pattern Error Boundary (로컬 — test-case 세그먼트 전용)
 * @description
 * app/test-case 세그먼트 내에서 발생한 렌더 에러를 캐치하는 로컬 Error Boundary.
 * app/error.tsx(전역) 대신 이 파일이 먼저 동작한다.
 *
 * onCaughtError 케이스(B-1):
 *   ThrowOnRender 컴포넌트가 마운트 → throw → 이 경계가 catch
 *   → 이 UI 렌더 + Console에 client.boundary 로그 출력
 *
 * "다시 시도" 버튼을 누르면 reset()이 호출되어 에러 상태를 초기화하고
 * 원래 page.tsx를 다시 렌더링 시도한다.
 *
 * TailwindCSS:
 *   - flex / min-h-[60vh] / items-center / justify-center: 세로 중앙 정렬
 *   - max-w-lg: 카드 최대 너비
 *   - bg-[var(--color-bg-secondary)]: 테마 대응 배경
 *   - text-[var(--color-text-primary|secondary|muted)]: 테마 텍스트
 *   - border-[var(--color-border)]: 테마 대응 보더
 */
'use client'

import { useEffect } from 'react'
import { Button, Panel, Badge } from '@/components/control'
import { ClientError } from '@/lib/errors/client-errors'
import { getClientLogger } from '@/lib/errors/client-logger'

export default function TestCaseError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const isClientError = error instanceof ClientError

  useEffect(() => {
    // client.boundary 이벤트로 구조화 로깅
    getClientLogger().error('client.boundary', {
      scope: 'test-case/error.tsx',
      category: isClientError ? (error as ClientError).category : 'render',
      traceId: isClientError ? (error as ClientError).traceId : crypto.randomUUID(),
      message: error.message,
      digest: error.digest,
      devMessage: isClientError ? (error as ClientError).devMessage : error.stack,
    })
  }, [error, isClientError])

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Panel variant="outlined" className="w-full max-w-lg text-center">
        {/* 케이스 표시 */}
        <div className="mb-2 flex items-center justify-center gap-2">
          <Badge variant="error">B-1 / onCaughtError</Badge>
          <Badge variant="warning">test-case/error.tsx</Badge>
        </div>

        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
          Error Boundary가 에러를 catch했습니다
        </h1>

        {isClientError && (
          <div className="mt-2 flex items-center justify-center gap-2">
            <Badge variant="error">{(error as ClientError).category}</Badge>
            <span className="font-mono text-xs text-[var(--color-text-muted)]">
              traceId: {(error as ClientError).traceId.slice(0, 8)}
            </span>
          </div>
        )}

        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">{error.message}</p>

        {error.digest && (
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Error digest: <span className="font-mono">{error.digest}</span>
          </p>
        )}

        <div className="mt-4 rounded bg-[var(--color-bg-tertiary)] p-3 text-left text-xs text-[var(--color-text-muted)]">
          <p className="font-semibold mb-1">확인 방법:</p>
          <p>1. 이 화면이 표시됨 → test-case/error.tsx 가 에러를 catch했음 (onCaughtError)</p>
          <p>2. DevTools Console → client.boundary JSON 로그 확인</p>
          <p>3. "다시 시도" 버튼으로 reset → page.tsx 재마운트</p>
        </div>

        <div className="mt-5">
          <Button variant="primary" onClick={reset}>
            다시 시도
          </Button>
        </div>
      </Panel>
    </div>
  )
}
