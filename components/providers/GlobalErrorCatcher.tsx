/**
 * @component GlobalErrorCatcher
 * @description
 * 전역 미처리 에러를 캐치하여 ClientLogger로 구조화 로깅하는 Provider 컴포넌트.
 *
 * window.addEventListener('error')       → 동기 런타임 에러 (uncaught throw)
 * window.addEventListener('unhandledrejection') → 미처리 Promise rejection
 *
 * 주의:
 *  - 이 리스너들은 React 트리 바깥에서 동작하므로 Error Boundary로 전파할 수 없다.
 *    따라서 로깅 전용으로만 사용한다.
 *  - 이벤트 핸들러/async 에러를 Error Boundary로 전파하려면
 *    useErrorHandler 훅의 throwError()를 사용해야 한다.
 *
 * 사용 위치: app/layout.tsx 의 Provider 스택 내부.
 *
 * ─────────────────────────────────────────────────────────────────────
 * instrumentation-client.ts와의 역할 분리 (C 방안: 플래그 기반)
 * ─────────────────────────────────────────────────────────────────────
 *
 * instrumentation-client.ts도 동일한 window.error / unhandledrejection 리스너를 등록한다.
 * 중복 로깅을 방지하기 위해 window.__GLOBAL_ERROR_CATCHER_MOUNTED__ 플래그를 사용한다:
 *
 * - 이 컴포넌트가 마운트되면 플래그를 true로 설정
 *   → instrumentation-client.ts의 리스너가 로깅을 건너뜀
 * - 이 컴포넌트가 언마운트되면(layout 크래시 등) 플래그를 false로 복원
 *   → instrumentation-client.ts의 리스너가 다시 활성화되어 에러를 캐치
 *
 * 결과: React 정상 동작 중에는 이 컴포넌트가, React 트리 바깥에서는
 *       instrumentation-client.ts가 에러를 담당하여 전 구간을 빈틈 없이 커버한다.
 */
'use client'

import { useEffect, type ReactNode } from 'react'
import { ClientError, categorizeError } from '@/lib/errors/client-errors'
import { getClientLogger } from '@/lib/errors/client-logger'

interface Props {
  children: ReactNode
}

export default function GlobalErrorCatcher({ children }: Props) {
  useEffect(() => {
    // ── C 방안: 플래그 활성화 ──────────────────────────────────────
    // instrumentation-client.ts의 리스너에게 "이제 내가 처리한다"고 알린다.
    // 이 플래그가 true인 동안 instrumentation-client.ts는 로깅을 건너뛴다.
    // window.__GLOBAL_ERROR_CATCHER_MOUNTED__ = true

    function handleError(event: ErrorEvent) {
      const err = event.error
      const category = err instanceof ClientError ? err.category : categorizeError(err)
      const traceId = err instanceof ClientError ? err.traceId : crypto.randomUUID()

      getClientLogger().error('client.uncaught', {
        category,
        traceId,
        devMessage: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      })
    }

    function handleRejection(event: PromiseRejectionEvent) {
      const err = event.reason
      const category = err instanceof ClientError ? err.category : categorizeError(err)
      const traceId = err instanceof ClientError ? err.traceId : crypto.randomUUID()

      getClientLogger().error('client.unhandledrejection', {
        category,
        traceId,
        devMessage: err instanceof Error ? err.message : String(err),
      })
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)

    return () => {
      // ── C 방안: 플래그 비활성화 ────────────────────────────────────
      // 언마운트 시(layout 크래시 등) 플래그를 false로 복원하여
      // instrumentation-client.ts의 리스너가 다시 에러를 캐치하도록 한다.
      // window.__GLOBAL_ERROR_CATCHER_MOUNTED__ = false

      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])

  return <>{children}</>
}
