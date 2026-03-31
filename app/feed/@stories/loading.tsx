/**
 * @route /feed → @stories 슬롯 로딩 UI
 * @pattern Parallel Routes — Slot-level Loading (Suspense)
 * @description
 * @stories 슬롯 전용 로딩 UI. 이 슬롯이 로딩 중이어도
 * @feed 등 다른 슬롯은 독립적으로 렌더링된다.
 */
import { Badge } from '@/components/control'

export default function StoriesLoading() {
  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
        <Badge variant="success">@stories</Badge> 스토리
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2 lg:flex-col">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="min-w-[80px] rounded-lg border border-border bg-bg-secondary p-3 text-center animate-pulse"
          >
            <div className="mx-auto h-8 w-8 rounded-full bg-bg-tertiary" />
            <div className="mt-2 mx-auto h-3 w-10 rounded bg-bg-tertiary" />
            <div className="mt-1 mx-auto h-2 w-8 rounded bg-bg-tertiary" />
          </div>
        ))}
      </div>
      <p className="text-xs text-text-muted">
        @stories 슬롯 로딩 중... (3초 지연 테스트)
      </p>
    </div>
  )
}
