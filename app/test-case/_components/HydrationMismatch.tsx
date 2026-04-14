'use client'

/**
 * @component HydrationMismatch
 * @description
 * React onRecoverableError (Hydration Mismatch) 케이스를 재현한다.
 *
 * ─── B-3: onRecoverableError (수화 불일치) 확인 ──────────────────
 *
 * 동작 원리:
 *   서버에서 렌더링한 HTML과 클라이언트에서 렌더링한 결과가 다를 때
 *   React는 경고를 발생시키고 클라이언트 결과로 DOM을 덮어쓴다 (recoverable).
 *   이 과정에서 React.createRoot() 의 onRecoverableError 콜백이 호출된다.
 *   Next.js에서는 이 경고가 DevTools Console에 출력된다.
 *
 * 확인 방법:
 *   1. 이 컴포넌트를 마운트한다 (page.tsx에서 B-3 케이스 선택 후 "에러 발생" 클릭)
 *   2. DevTools Console에서 아래 경고 확인:
 *      "Warning: Text content did not match. Server: "..." Client: "...""
 *      또는 (React 18/19)
 *      "Warning: An error occurred during hydration. The server HTML was replaced with client content"
 *   3. 페이지가 에러 없이 계속 표시됨 (recoverable이므로 error.tsx로 이동 안 함)
 *
 * ⚠️ 주의:
 *   - suppressHydrationWarning prop을 사용하면 경고가 억제된다. 여기서는 의도적으로 사용 안 함.
 *   - 개발 모드에서만 경고가 상세히 출력된다.
 *   - 프로덕션 빌드에서는 React가 조용히 클라이언트 값으로 덮어쓴다.
 *
 */

export default function HydrationMismatch() {
  // JSX 본문에서 직접 서버/클라이언트 분기 → 첫 렌더 결과가 달라 hydration mismatch 발생
  const renderedOn = typeof window === 'undefined' ? 'SERVER' : 'CLIENT'
  const randomValue = Math.random().toFixed(6)

  return (
    <div className="rounded bg-[var(--color-bg-tertiary)] p-3 text-xs text-[var(--color-text-secondary)]">
      <p className="font-semibold mb-1">B-2 Hydration Mismatch 컴포넌트</p>
      {/* 서버/클라이언트 값 불일치 유발 — suppressHydrationWarning 의도적으로 미사용 */}
      <p>렌더 위치: <strong>{renderedOn}</strong></p>
      <p>랜덤 값: {randomValue}</p>
      <p className="mt-1 text-[var(--color-text-muted)]">
        ↑ DevTools Console에서 hydration 경고 확인 (개발 모드에서만 상세 출력)
      </p>
    </div>
  )
}
