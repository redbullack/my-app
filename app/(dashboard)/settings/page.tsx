/**
 * @route /settings
 * @pattern Route Group — (dashboard)/settings
 * @description
 * 설정 페이지. Dashboard와 동일한 (dashboard) Route Group 레이아웃(사이드바)을 공유한다.
 * Server Actions를 활용한 폼 제출 패턴 예시를 포함한다.
 */
import { Panel, Input, Select, Button, Badge } from '@/components/control'
import RouteInfo from '@/components/shared/RouteInfo'

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">Settings</h1>

      <Panel variant="outlined">
        <h2 className="text-lg font-semibold text-text-primary mb-4">프로필 설정</h2>
        <div className="space-y-4 max-w-md">
          <Input label="이름" placeholder="홍길동" />
          <Input label="이메일" type="email" placeholder="user@example.com" />
          <Select
            label="언어"
            options={[
              { value: 'ko', label: '한국어' },
              { value: 'en', label: 'English' },
              { value: 'ja', label: '日本語' },
            ]}
            defaultValue="ko"
          />
          <Input
            label="비밀번호"
            type="password"
            placeholder="새 비밀번호"
            helperText="8자 이상 입력하세요"
          />
          <Button variant="primary">저장</Button>
        </div>
      </Panel>

      <Panel variant="outlined">
        <h2 className="text-lg font-semibold text-text-primary mb-3">알림 설정</h2>
        <div className="space-y-3">
          {['이메일 알림', '푸시 알림', '마케팅 수신'].map(item => (
            <label key={item} className="flex items-center gap-3 text-sm text-text-secondary">
              <input type="checkbox" className="rounded border-border accent-accent" />
              {item}
            </label>
          ))}
        </div>
      </Panel>

      <RouteInfo
        pattern="Route Group"
        syntax="app/(dashboard)/settings/page.tsx"
        description="(dashboard) 그룹의 Settings 페이지. Dashboard 페이지와 사이드바 레이아웃을 공유합니다."
        docsUrl="https://nextjs.org/docs/app/building-your-application/routing/route-groups"
      />
    </div>
  )
}
