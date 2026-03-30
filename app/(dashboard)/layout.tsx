/**
 * @route /(dashboard)/*
 * @pattern Route Group — (dashboard)
 * @description
 * (dashboard) Route Group의 공유 레이아웃.
 * 사이드바 + 메인 콘텐츠 영역의 2단 레이아웃을 제공한다.
 * (marketing) 그룹과는 완전히 다른 레이아웃 구조를 가진다.
 *
 * 이것이 Route Group의 핵심 용도: 같은 레벨의 라우트들에게
 * 서로 다른 레이아웃을 적용하면서도 URL 구조에는 영향을 주지 않는다.
 */
import Sidebar from '@/components/layout/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-8rem)]">
      <Sidebar />
      <div className="flex-1 p-6">{children}</div>
    </div>
  )
}
