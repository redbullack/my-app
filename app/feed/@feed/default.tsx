/**
 * @pattern Parallel Routes — default.tsx (Fallback)
 * @description
 * @feed 슬롯의 default fallback.
 * 현재 URL이 이 슬롯과 매칭되지 않을 때(예: 소프트 네비게이션 후)
 * 404 대신 이 컴포넌트가 렌더링된다.
 * default.tsx가 없으면 매칭 실패 시 전체 페이지가 404가 된다.
 */
export default function FeedDefault() {
  return (
    <div className="rounded-lg border border-border p-4 text-center text-sm text-text-muted">
      @feed 슬롯 기본 상태
    </div>
  )
}
