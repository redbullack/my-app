'use client'

/**
 * @route /feed → @feed 슬롯 에러 UI
 * @pattern Parallel Routes — Slot-level Error Boundary
 * @description
 * @feed 슬롯 전용 에러 바운더리. 이 슬롯에서 에러가 발생해도
 * @stories 등 다른 슬롯은 정상적으로 렌더링된다.
 */
import { Panel, Badge, Button } from '@/components/control'

export default function FeedError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
        <Badge variant="error">@feed</Badge> 피드 — 에러 발생
      </h2>
      <Panel variant="outlined" className="border-red-400 dark:border-red-600">
        <p className="text-sm font-medium text-red-600 dark:text-red-400">
          {error.message}
        </p>
        <p className="mt-2 text-xs text-text-muted">
          이 에러는 @feed 슬롯에만 영향을 주며, @stories 슬롯은 독립적으로 정상 동작합니다.
        </p>
        <Button variant="danger" size="sm" className="mt-3" onClick={reset}>
          다시 시도
        </Button>
      </Panel>
    </div>
  )
}
