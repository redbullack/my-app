/**
 * @route   /test-case/b2
 * @pattern Server Component + Client Component (Hydration Mismatch 재현 전용)
 * @description
 * B-2: React onRecoverableError (Hydration Mismatch) 경고를 실제로 발생시키기 위한 전용 라우트.
 *
 * 재현 원리:
 *   - 이 페이지는 Server Component이므로 최초 요청 시 서버에서 HTML이 렌더된다.
 *   - HydrationMismatch 컴포넌트는 JSX 본문에서 `typeof window` / `Math.random()` 을
 *     직접 사용하여 서버 렌더 결과와 클라이언트 첫 렌더 결과가 달라진다.
 *   - React 19 hydration 과정에서 불일치를 감지 → onRecoverableError → Console 경고 출력.
 *   - 페이지는 복구되어 정상 표시됨 (recoverable).
 *
 * 확인 방법:
 *   1. 이 URL(/test-case/b2)로 직접 진입 또는 새로고침.
 *   2. DevTools Console 에서 hydration 관련 경고 확인:
 *      "Hydration failed because the server rendered HTML didn't match the client"
 *      또는 "Text content did not match. Server: ... Client: ..."
 */

import HydrationMismatch from '../_components/HydrationMismatch'

export default function TestCaseB2Page() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          B-2: Hydration Mismatch 재현 페이지
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          이 페이지는 서버 렌더링 단계에서 <code className="font-mono">HydrationMismatch</code>{' '}
          컴포넌트를 포함하여, 서버/클라이언트 첫 렌더 결과의 차이로 인한 hydration 경고를
          실제로 발생시킵니다. 브라우저 DevTools Console 을 열고 페이지를 새로고침하세요.
        </p>
      </div>

      <HydrationMismatch />

      <div className="mt-6 rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 text-xs text-[var(--color-text-secondary)]">
        <p className="font-semibold text-[var(--color-text-primary)] mb-2">확인 포인트</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>서버 렌더 HTML: "렌더 위치: SERVER"</li>
          <li>클라이언트 렌더 결과: "렌더 위치: CLIENT" → hydration 시 덮어쓰기</li>
          <li>Console 경고: Hydration failed / Text content did not match</li>
          <li>경고 발생 후에도 페이지는 정상 동작 (recoverable error)</li>
        </ul>
      </div>
    </div>
  )
}
