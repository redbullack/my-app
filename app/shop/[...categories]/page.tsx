/**
 * @route /shop/[...categories]
 * @pattern Catch-all Segment ([...param])
 * @description
 * Catch-all 세그먼트. /shop 이후의 모든 경로 세그먼트를 배열로 캡처한다.
 * 예: /shop/electronics/phones → params.categories = ['electronics', 'phones']
 *
 * [...param]은 최소 1개의 세그먼트가 필요하다 (/shop만으로는 매칭되지 않음).
 * 0개도 허용하려면 [[...param]] (Optional Catch-all)을 사용한다.
 *
 * Next.js 16: params는 Promise — await 필수.
 */
import { Panel, Badge } from '@/components/control'
import RouteInfo from '@/components/shared/RouteInfo'
import CodeBlock from '@/components/shared/CodeBlock'
import Link from 'next/link'

export default async function ShopCatchAllPage({
  params,
}: {
  params: Promise<{ categories: string[] }>
}) {
  const { categories } = await params

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold text-text-primary">Shop</h1>
      <p className="mt-2 text-text-secondary">
        Catch-all 세그먼트로 다단계 카테고리 경로를 캡처합니다.
      </p>

      {/* 브레드크럼 */}
      <nav className="mt-6 flex items-center gap-2 text-sm">
        <Link href="/shop/all" className="text-accent hover:underline">Shop</Link>
        {categories.map((cat, i) => (
          <span key={i} className="flex items-center gap-2">
            <span className="text-text-muted">/</span>
            <Link
              href={`/shop/${categories.slice(0, i + 1).join('/')}`}
              className="text-accent hover:underline"
            >
              {cat}
            </Link>
          </span>
        ))}
      </nav>

      <Panel variant="outlined" className="mt-6">
        <h2 className="font-semibold text-text-primary mb-3">캡처된 세그먼트</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {categories.map((cat, i) => (
            <Badge key={i} variant={i % 2 === 0 ? 'info' : 'success'}>
              [{i}] {cat}
            </Badge>
          ))}
        </div>
        <CodeBlock
          language="json"
          code={JSON.stringify({ categories }, null, 2)}
        />
      </Panel>

      <Panel variant="default" className="mt-4">
        <h3 className="font-semibold text-text-primary mb-2">다른 경로 테스트</h3>
        <div className="flex flex-wrap gap-2">
          {[
            '/shop/electronics',
            '/shop/electronics/phones',
            '/shop/clothing/men/shirts',
            '/shop/books/fiction/sci-fi/2024',
          ].map(path => (
            <Link key={path} href={path}>
              <Badge variant="warning" className="cursor-pointer hover:opacity-80">{path}</Badge>
            </Link>
          ))}
        </div>
      </Panel>

      <RouteInfo
        pattern="Catch-all Segment"
        syntax="app/shop/[...categories]/page.tsx"
        description="[...param]은 이후 모든 세그먼트를 문자열 배열로 캡처합니다. 최소 1개 세그먼트가 필요하며, /shop만으로는 매칭되지 않습니다."
        docsUrl="https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes#catch-all-segments"
      />
    </div>
  )
}
