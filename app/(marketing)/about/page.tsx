/**
 * @route /about
 * @pattern Route Group — (marketing)/about
 * @description
 * (marketing) Route Group에 속한 About 페이지.
 * 실제 URL은 /about이며, /marketing/about이 아니다.
 * Route Group 레이아웃(marketing/layout.tsx)이 자동 적용된다.
 */
import { Panel, Badge, Button } from '@/components/control'
import RouteInfo from '@/components/shared/RouteInfo'
import CodeBlock from '@/components/shared/CodeBlock'

export default function AboutPage() {
  return (
    <>
      <h1 className="text-3xl font-bold text-text-primary">About</h1>
      <p className="mt-3 text-text-secondary">
        이 프로젝트는 Next.js 16 App Router의 모든 기능을 학습하기 위한 연습용 프레임워크입니다.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Panel variant="elevated">
          <Badge variant="info">React 19</Badge>
          <h3 className="mt-2 font-semibold text-text-primary">Server Components</h3>
          <p className="mt-1 text-sm text-text-secondary">
            기본적으로 모든 컴포넌트는 Server Component로 동작합니다.
          </p>
        </Panel>
        <Panel variant="elevated">
          <Badge variant="success">TailwindCSS 4</Badge>
          <h3 className="mt-2 font-semibold text-text-primary">CSS 기반 설정</h3>
          <p className="mt-1 text-sm text-text-secondary">
            tailwind.config.js 대신 CSS 파일에서 @theme으로 설정합니다.
          </p>
        </Panel>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold text-text-primary mb-3">Route Group 구조</h2>
        <CodeBlock
          language="text"
          code={`app/
├── (marketing)/        ← Route Group (URL에 미포함)
│   ├── layout.tsx      ← 공유 레이아웃
│   ├── about/page.tsx  → /about
│   └── pricing/page.tsx → /pricing
└── (dashboard)/        ← 또 다른 Route Group
    ├── layout.tsx
    └── dashboard/page.tsx → /dashboard`}
        />
      </div>

      <RouteInfo
        pattern="Route Group"
        syntax="app/(marketing)/about/page.tsx"
        description="(괄호)로 감싼 폴더는 URL에 포함되지 않으며, 동일 레이아웃을 공유하는 페이지를 논리적으로 그룹화합니다."
        docsUrl="https://nextjs.org/docs/app/building-your-application/routing/route-groups"
      />
    </>
  )
}
