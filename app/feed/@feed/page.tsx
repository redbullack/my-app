/**
 * @route /feed → @feed 슬롯
 * @pattern Parallel Routes — Named Slot (@feed)
 * @description
 * @feed 병렬 슬롯의 기본 페이지. layout의 feed prop으로 렌더링된다.
 * 피드 목록을 독립적으로 표시하며, 이 슬롯만의 로딩/에러 상태를 가질 수 있다.
 */
import { Panel, Badge } from '@/components/control'

const FEED_ITEMS = [
  { id: 1, author: '김개발', content: 'Next.js 16의 Parallel Routes가 정말 강력하네요!', time: '3분 전' },
  { id: 2, author: '이디자인', content: 'TailwindCSS v4의 @theme 지시어가 편리합니다.', time: '15분 전' },
  { id: 3, author: '박서버', content: 'Server Actions로 API 없이 폼 처리하는 게 신세계!', time: '1시간 전' },
  { id: 4, author: '최풀스택', content: 'React 19의 use() 훅으로 Promise를 직접 unwrap 할 수 있어요.', time: '2시간 전' },
]

export default function FeedSlot() {
  // ⚠️ [테스트용] 아래 throw 주석을 해제하면 @feed 슬롯에서 에러가 발생합니다.
  // @stories 슬롯은 정상 동작하는 것을 확인할 수 있습니다.
  throw new Error('[@feed] 테스트용 에러: 이 에러는 @feed 슬롯에만 영향을 줍니다!')
  // ⚠️ [테스트용 끝]
  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
        <Badge variant="info">@feed</Badge> 피드
      </h2>
      {FEED_ITEMS.map(item => (
        <Panel key={item.id} variant="outlined">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-text-primary">{item.author}</span>
            <span className="text-xs text-text-muted">{item.time}</span>
          </div>
          <p className="text-sm text-text-secondary">{item.content}</p>
        </Panel>
      ))}
    </div>
  )
}
