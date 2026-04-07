/**
 * @pattern Global Error Boundary
 * @description
 * Root Layout 자체(ThemeProvider, SessionProvider, Header/Footer 등)에서
 * 렌더링 에러가 발생했을 때 마지막 보루로 동작하는 최상위 에러 바운더리.
 *
 * 주의사항:
 * - global-error.tsx는 root layout을 대체하므로 반드시 자체 <html>, <body>를 렌더해야 한다.
 * - 'use client' 필수 (Error Boundary는 클라이언트에서만 동작).
 * - ThemeProvider가 깨졌을 가능성을 전제로 하므로 Context에 의존하지 않는다.
 *   대신 FOUC 방지 스크립트와 동일한 방식으로 html의 'dark' 클래스만 복원한다.
 * - 디자인 시스템(Panel, Button 등)도 내부적으로 Context/Provider에 의존할 수 있어
 *   여기서는 의도적으로 순수 Tailwind만 사용한다.
 *
 * props:
 * - error: 발생한 에러 객체 (production에선 digest만 유의미)
 * - reset: 루트 세그먼트 재마운트 시도
 */
'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // TODO: 운영 환경에서는 Sentry/Datadog 등 관측 서비스로 전송
    // 예) Sentry.captureException(error, { tags: { scope: 'global-error', digest: error.digest } })
    console.error('[GlobalError]', error)
  }, [error])

  /** global-error에서도 테마를 유지하기 위해 useEffect로 테마 클래스 적용 (layout.tsx와 동일 로직)
   *  'use client' 환경에서는 <script> 태그가 React에 의해 실행되지 않으므로 useEffect를 사용한다.
   */
  useEffect(() => {
    try {
      const t = localStorage.getItem('theme')
      const dark = t === 'dark' || ((!t || t === 'system') && window.matchMedia('(prefers-color-scheme:dark)').matches)
      if (dark) document.documentElement.classList.add('dark')
    } catch(e) {}
  }, [])

  return (
    <html lang="ko">
      <head>
        <title>치명적 오류가 발생했습니다</title>
      </head>
      {/*
        Tailwind v4 유틸리티 사용 설명:
        - min-h-screen: 뷰포트 전체 높이 확보
        - flex / items-center / justify-center: 중앙 정렬
        - bg-white dark:bg-slate-900: 라이트/다크 배경 (Provider 없이 동작하도록 variable 대신 팔레트 직접 사용)
        - text-slate-900 dark:text-slate-100: 본문 텍스트 색
        - rounded-2xl / border / shadow-lg: Panel과 유사한 카드 외형
      */}
      <body className="min-h-screen flex items-center justify-center bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg p-8 text-center">
          {/* 아이콘 */}
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7 text-red-600 dark:text-red-400"
              aria-hidden="true"
            >
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            </svg>
          </div>

          <h1 className="text-xl font-bold">치명적인 오류가 발생했습니다</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            애플리케이션 루트 레이아웃에서 복구할 수 없는 오류가 발생했습니다.
            <br />
            불편을 드려 죄송합니다. 아래 버튼으로 다시 시도하거나 페이지를 새로고침해 주세요.
          </p>

          {/* 개발 환경에서만 에러 메시지 상세 노출 (production에선 React가 마스킹) */}
          {error?.message && (
            <pre className="mt-4 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-100 dark:bg-slate-900 p-3 text-left text-xs text-slate-700 dark:text-slate-300">
              {error.message}
            </pre>
          )}
          {error?.digest && (
            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-500">
              Error digest: <span className="font-mono">{error.digest}</span>
            </p>
          )}

          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
            >
              다시 시도
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') window.location.href = '/'
              }}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 shadow-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
            >
              홈으로 이동
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
