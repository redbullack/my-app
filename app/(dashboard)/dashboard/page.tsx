/**
 * @route /dashboard
 * @pattern Route Group — (dashboard)/dashboard
 * @description
 * 대시보드 메인 페이지. (dashboard) Route Group에 속하며
 * 사이드바가 있는 레이아웃이 자동 적용된다.
 * 컨트롤 컴포넌트 사용 예시를 포함한다.
 */
import { Panel, Badge, Button, Input, Select } from '@/components/control'
import RouteInfo from '@/components/shared/RouteInfo'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>

      {/* 통계 카드 */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Panel variant="outlined">
          <p className="text-sm text-text-muted">총 방문자</p>
          <p className="mt-1 text-3xl font-bold text-text-primary">12,345</p>
          <Badge variant="success" className="mt-2">+12%</Badge>
        </Panel>
        <Panel variant="outlined">
          <p className="text-sm text-text-muted">페이지뷰</p>
          <p className="mt-1 text-3xl font-bold text-text-primary">45,678</p>
          <Badge variant="info" className="mt-2">+5%</Badge>
        </Panel>
        <Panel variant="outlined">
          <p className="text-sm text-text-muted">이탈률</p>
          <p className="mt-1 text-3xl font-bold text-text-primary">23.4%</p>
          <Badge variant="warning" className="mt-2">-2%</Badge>
        </Panel>
      </div>

      {/* 컨트롤 데모 */}
      <Panel variant="elevated">
        <h2 className="text-lg font-semibold text-text-primary mb-4">컨트롤 데모</h2>
        <div className="space-y-4">
          <Input label="검색" type="search" placeholder="키워드를 입력하세요" />
          <Select
            label="기간"
            options={[
              { value: '7d', label: '최근 7일' },
              { value: '30d', label: '최근 30일' },
              { value: '90d', label: '최근 90일' },
            ]}
            defaultValue="7d"
          />
          <div className="flex gap-2">
            <Button variant="primary" size="sm">조회</Button>
            <Button variant="ghost" size="sm">초기화</Button>
          </div>
        </div>
      </Panel>

      <RouteInfo
        pattern="Route Group"
        syntax="app/(dashboard)/dashboard/page.tsx"
        description="(dashboard) 그룹은 사이드바 레이아웃을 공유합니다. (marketing) 그룹과 다른 레이아웃이지만 URL에 그룹명은 나타나지 않습니다."
        docsUrl="https://nextjs.org/docs/app/building-your-application/routing/route-groups"
      />
    </div>
  )
}
