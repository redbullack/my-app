/**
 * @route /pricing
 * @pattern Route Group — (marketing)/pricing
 * @description
 * (marketing) Route Group에 속한 Pricing 페이지.
 * 실제 URL은 /pricing. About 페이지와 동일한 marketing 레이아웃을 공유한다.
 */
import { Panel, Badge, Button } from '@/components/control'
import RouteInfo from '@/components/shared/RouteInfo'

const PLANS = [
  {
    name: 'Starter',
    price: '무료',
    features: ['기본 라우팅', 'Server Components', 'TailwindCSS'],
    badge: 'info' as const,
  },
  {
    name: 'Pro',
    price: '₩29,000/월',
    features: ['Parallel Routes', 'Intercepting Routes', 'Streaming SSR', 'Server Actions'],
    badge: 'success' as const,
    recommended: true,
  },
  {
    name: 'Enterprise',
    price: '문의',
    features: ['전체 기능', 'Middleware', 'Edge Runtime', '전용 지원'],
    badge: 'warning' as const,
  },
]

export default function PricingPage() {
  return (
    <>
      <h1 className="text-3xl font-bold text-text-primary">Pricing</h1>
      <p className="mt-3 text-text-secondary">학습 목적의 가상 요금제 페이지입니다.</p>

      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        {PLANS.map(plan => (
          <Panel
            key={plan.name}
            variant={plan.recommended ? 'elevated' : 'outlined'}
            className={plan.recommended ? 'ring-2 ring-accent' : ''}
          >
            {plan.recommended && (
              <Badge variant="success" className="mb-2">추천</Badge>
            )}
            <h3 className="text-lg font-bold text-text-primary">{plan.name}</h3>
            <p className="mt-1 text-2xl font-bold text-accent">{plan.price}</p>
            <ul className="mt-4 space-y-2">
              {plan.features.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-text-secondary">
                  <span className="text-success">✓</span> {f}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Button
                variant={plan.recommended ? 'primary' : 'secondary'}
                className="w-full"
              >
                선택하기
              </Button>
            </div>
          </Panel>
        ))}
      </div>

      <RouteInfo
        pattern="Route Group"
        syntax="app/(marketing)/pricing/page.tsx"
        description="(marketing) 그룹 내의 페이지. About과 같은 레이아웃을 공유하지만 URL은 /pricing입니다."
        docsUrl="https://nextjs.org/docs/app/building-your-application/routing/route-groups"
      />
    </>
  )
}
