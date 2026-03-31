/**
 * @route /feed → @stories 슬롯
 * @pattern Parallel Routes — Named Slot (@stories)
 * @description
 * @stories 병렬 슬롯. @feed와 독립적으로 렌더링되며,
 * layout에서 stories prop으로 사이드 영역에 배치된다.
 */
import { Panel, Badge } from '@/components/control'

const STORIES = [
  { id: 1, user: '민지', emoji: '🏔️', label: '여행' },
  { id: 2, user: '하늘', emoji: '🍕', label: '맛집' },
  { id: 3, user: '서준', emoji: '💻', label: '코딩' },
  { id: 4, user: '유진', emoji: '🎨', label: '디자인' },
  { id: 5, user: '준서', emoji: '📚', label: '독서' },
]

// ⚠️ [테스트용] 아래 sleep + async를 주석 처리하면 로딩 없이 즉시 렌더링됩니다.
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export default async function StoriesSlot() {
  await sleep(3000)
  // ⚠️ [테스트용 끝] — 원복 시 async 제거, sleep 호출 제거, 상단 sleep 함수 제거
  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
        <Badge variant="success">@stories</Badge> 스토리
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2 lg:flex-col">
        {STORIES.map(story => (
          <Panel key={story.id} variant="outlined" className="min-w-[80px] text-center !p-3">
            <div className="text-2xl">{story.emoji}</div>
            <p className="mt-1 text-xs font-medium text-text-primary">{story.user}</p>
            <p className="text-xs text-text-muted">{story.label}</p>
          </Panel>
        ))}
      </div>
    </div>
  )
}
