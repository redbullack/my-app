/**
 * @route /
 * @pattern 기본 라우트 (Static Route)
 * @description
 * 홈 페이지. 프로젝트에서 구현된 모든 라우팅 패턴을 카드 형태로 나열하여
 * 각 패턴 페이지로의 네비게이션을 제공한다.
 * Server Component로 작성되어 서버에서 렌더링된다.
 */
import Link from 'next/link'
import { Panel, Badge } from '@/components/control'
import RouteInfo from '@/components/shared/RouteInfo'

const PATTERNS = [
  {
    title: 'Route Group',
    badge: '(group)',
    href: '/about',
    description: '(marketing) 그룹의 About 페이지. URL에 그룹명이 포함되지 않는다.',
    variant: 'info' as const,
  },
  {
    title: 'Dynamic Segment',
    badge: '[slug]',
    href: '/blog',
    description: 'URL 파라미터를 동적으로 매핑하는 블로그 페이지.',
    variant: 'success' as const,
  },
  {
    title: 'Catch-all Segment',
    badge: '[...categories]',
    href: '/shop/electronics/phones',
    description: '다단계 경로를 배열로 캡처하는 Shop 페이지.',
    variant: 'warning' as const,
  },
  {
    title: 'Optional Catch-all',
    badge: '[[...slug]]',
    href: '/docs',
    description: '루트 포함 다단계 경로를 선택적으로 캡처하는 Docs 페이지.',
    variant: 'error' as const,
  },
  {
    title: 'Parallel Routes',
    badge: '@slot',
    href: '/feed',
    description: '여러 슬롯을 동시에 렌더링하는 Feed 페이지.',
    variant: 'info' as const,
  },
  {
    title: 'Intercepting Routes',
    badge: '(.)',
    href: '/gallery',
    description: '갤러리 상세를 모달로 가로채는 예제.',
    variant: 'success' as const,
  },
  {
    title: 'Dashboard (Route Group)',
    badge: '(dashboard)',
    href: '/dashboard',
    description: '사이드바 레이아웃을 가진 대시보드 그룹.',
    variant: 'warning' as const,
  },
  {
    title: 'API Route Handler',
    badge: 'route.ts',
    href: '/api/hello',
    description: 'REST API 엔드포인트 (JSON 응답).',
    variant: 'error' as const,
  },
]

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-text-primary">
          Next.js 16 App Router Lab
        </h1>
        <p className="mt-3 text-lg text-text-secondary">
          모든 App Router 라우팅 패턴을 직접 체험해보세요
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PATTERNS.map(item => (
          <Link key={item.href} href={item.href}>
            <Panel variant="outlined" className="h-full hover:border-accent/50 transition-colors">
              <div className="mb-2 flex items-center gap-2">
                <Badge variant={item.variant}>{item.badge}</Badge>
                <h2 className="font-semibold text-text-primary">{item.title}</h2>
              </div>
              <p className="text-sm text-text-secondary">{item.description}</p>
            </Panel>
          </Link>
        ))}
      </div>

      <RouteInfo
        pattern="Static Route"
        syntax="app/page.tsx"
        description="가장 기본적인 정적 라우트. / 경로에 매핑되는 홈 페이지입니다."
        docsUrl="https://nextjs.org/docs/app/building-your-application/routing/pages"
      />
    </div>
  )
}
