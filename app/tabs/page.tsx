/**
 * @route /tabs
 * @pattern Static Route
 * @description
 * Tab/TabSub 컴포넌트 예제 인덱스 페이지.
 * 3가지 탭 구현 방식의 예제로 이동할 수 있는 링크를 제공한다.
 */
import Link from 'next/link'
import { Panel, Badge } from '@/components/control'
import RouteInfo from '@/components/shared/RouteInfo'

const EXAMPLES = [
  {
    href: '/tabs/example-a',
    title: 'Example A — 클라이언트 상태',
    badge: 'Grid + Chart' as const,
    description:
      '단일 페이지에서 useState로 탭 상태를 관리한다. 매출 그리드 탭과 SVG 바 차트 탭 간 데이터 통신을 보여준다.',
  },
  {
    href: '/tabs/example-b',
    title: 'Example B — searchParams 기반',
    badge: 'URL Routing' as const,
    description:
      'URL의 ?tab= 파라미터로 탭 상태를 관리한다. 브라우저 뒤로가기/앞으로가기로 탭 전환이 가능하다.',
  },
  {
    href: '/tabs/example-c',
    title: 'Example C — 크로스탭 통신',
    badge: 'Cart Pattern' as const,
    description:
      '상품 목록 탭에서 장바구니 탭으로 아이템을 추가하는 실용적 패턴. 부모 상태를 통한 탭 간 통신을 보여준다.',
  },
]

export default function TabsIndexPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Tab 컴포넌트 예제</h1>
        <p className="mt-2 text-text-secondary">
          Tab / TabSub 컴포넌트를 활용한 3가지 구현 방식을 비교합니다.
        </p>
      </div>

      <div className="space-y-4">
        {EXAMPLES.map((ex) => (
          <Link key={ex.href} href={ex.href} className="block">
            <Panel variant="outlined" className="transition-colors hover:border-accent">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">{ex.title}</h2>
                  <p className="mt-1 text-sm text-text-secondary">{ex.description}</p>
                </div>
                <Badge variant="info">{ex.badge}</Badge>
              </div>
            </Panel>
          </Link>
        ))}
      </div>

      <RouteInfo
        pattern="Static Route"
        syntax="app/tabs/page.tsx"
        description="Tab 컴포넌트 예제의 인덱스 페이지. 3가지 탭 구현 방식의 예제를 안내한다."
      />
    </div>
  )
}
