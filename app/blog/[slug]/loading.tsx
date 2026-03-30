/**
 * @pattern Loading UI — 세그먼트별 로딩 상태
 * @description
 * blog/[slug] 세그먼트 전용 로딩 UI.
 * 이 loading.tsx는 상위(app/loading.tsx)와 별개로,
 * 이 세그먼트의 페이지가 렌더링되는 동안에만 표시된다.
 * Next.js가 자동으로 <Suspense>로 감싸준다.
 */
import { Panel } from '@/components/control'

export default function BlogPostLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="h-4 w-24 animate-pulse rounded bg-bg-tertiary" />
      <div className="mt-6 space-y-4">
        <div className="h-8 w-3/4 animate-pulse rounded bg-bg-tertiary" />
        <div className="h-4 w-1/4 animate-pulse rounded bg-bg-tertiary" />
        <Panel variant="default" className="mt-6">
          <div className="space-y-3">
            <div className="h-4 w-full animate-pulse rounded bg-bg-tertiary" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-bg-tertiary" />
            <div className="h-4 w-4/6 animate-pulse rounded bg-bg-tertiary" />
          </div>
        </Panel>
      </div>
    </div>
  )
}
