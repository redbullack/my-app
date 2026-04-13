'use client'

/**
 * @component ThrowOnRender
 * @description
 * 렌더 시점에 즉시 에러를 throw하여 React Error Boundary 동작을 테스트한다.
 *
 * ─── B-1: test-case/error.tsx (로컬 Error Boundary) 확인 ──────────
 * 이 컴포넌트가 마운트되면 아래 흐름이 발생한다:
 *   1. ThrowOnRender → throw Error
 *   2. React가 가장 가까운 Error Boundary 탐색
 *   3. app/test-case/error.tsx 가 catch → 해당 UI 렌더
 *   4. DevTools Console: client.boundary 로그 확인 (app/error.tsx 내부)
 *
 * ─── B-4: global-error.tsx (최상위 Error Boundary) 확인 ───────────
 *
 * ⚠️ 주의: layout.tsx를 직접 수정해야 하며, 반드시 테스트 후 원복해야 한다.
 *
 * [방법 1] app/layout.tsx RootLayout 함수 최상단에 throw 추가:
 *   export default function RootLayout(...) {
 *     throw new Error('global-error.tsx 테스트용 — 테스트 후 이 줄 삭제!')
 *     return ( ... )
 *   }
 *
 * [방법 2] app/layout.tsx 에서 ThemeProvider import를 망가뜨리기:
 *   import ThemeProvider from '@/components/layout/ThemeProviderXXX' // 존재하지 않는 경로
 *   → 빌드 또는 런타임 에러로 global-error.tsx 렌더
 *
 * → 위 수정 후 브라우저에서 아무 페이지나 새로고침하면 global-error.tsx UI가 뜬다.
 * → Console: [GlobalError] Error: ... 출력 확인.
 * → 테스트 완료 후 반드시 원복할 것!
 *
 * ─────────────────────────────────────────────────────────────────
 */

interface Props {
  /** throw할 에러 메시지 */
  message?: string
}

export default function ThrowOnRender({ message = 'B-1: 의도적 렌더 에러 — Error Boundary 테스트' }: Props): never {
  // 렌더 중 즉시 throw — Error Boundary가 catch한다
  throw new Error(message)
}
