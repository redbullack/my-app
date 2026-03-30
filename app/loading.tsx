/**
 * @pattern Loading UI (Suspense)
 * @description
 * 루트 레벨 로딩 UI. Next.js는 loading.tsx를 자동으로 <Suspense>로 감싸
 * 페이지가 준비될 때까지 이 컴포넌트를 표시한다.
 * 각 라우트 세그먼트별로 loading.tsx를 둘 수 있어, 세분화된 로딩 상태를 구현할 수 있다.
 */
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-accent" />
        <p className="text-sm text-text-muted">로딩 중...</p>
      </div>
    </div>
  )
}
