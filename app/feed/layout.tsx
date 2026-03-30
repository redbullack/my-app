/**
 * @route /feed
 * @pattern Parallel Routes — Layout with @slots
 * @description
 * Parallel Routes 레이아웃. @feed와 @stories 두 슬롯을 동시에 렌더링한다.
 *
 * Parallel Routes는 @폴더명 규칙으로 슬롯을 정의하고,
 * 부모 layout이 이를 props로 받아 원하는 위치에 배치한다.
 *
 * 슬롯은 독립적으로 로딩/에러 상태를 가질 수 있어,
 * 한 영역의 로딩이 다른 영역에 영향을 주지 않는다.
 */
export default function FeedLayout({
  children,
  feed,
  stories,
}: {
  children: React.ReactNode
  feed: React.ReactNode
  stories: React.ReactNode
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      {children}
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">{feed}</div>
        <div>{stories}</div>
      </div>
    </div>
  )
}
