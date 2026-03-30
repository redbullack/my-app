/**
 * @route /gallery/[id]
 * @pattern Dynamic Segment + Intercepting Routes 대상
 * @description
 * 갤러리 상세 전체 페이지. URL을 직접 입력하거나 새로고침했을 때 렌더링된다.
 * 소프트 네비게이션(Link)에서는 @modal/(.)gallery/[id]가 이 라우트를 가로채서
 * 모달로 표시하지만, 하드 네비게이션에서는 이 페이지가 표시된다.
 *
 * Next.js 16: params는 Promise.
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { SAMPLE_GALLERY } from '@/lib/constants'
import { Panel, Badge, Button } from '@/components/control'
import RouteInfo from '@/components/shared/RouteInfo'

export default async function GalleryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const item = SAMPLE_GALLERY.find(g => g.id === id)

  if (!item) notFound()

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/gallery" className="text-sm text-accent hover:underline">
        ← 갤러리 목록
      </Link>

      <div className="mt-6">
        <div className={`h-64 rounded-xl ${item.color}`} />
        <div className="mt-6">
          <Badge variant="info">ID: {item.id}</Badge>
          <h1 className="mt-2 text-3xl font-bold text-text-primary">{item.title}</h1>
          <p className="mt-2 text-text-secondary">{item.description}</p>
        </div>

        <Panel variant="default" className="mt-6">
          <p className="text-sm text-text-muted">
            이 페이지는 하드 네비게이션(URL 직접 입력/새로고침) 시 표시됩니다.
            Link를 통한 소프트 네비게이션에서는 @modal/(.)gallery/[id]가 가로채서
            모달로 표시합니다.
          </p>
        </Panel>
      </div>

      <RouteInfo
        pattern="Intercepting Routes (Full Page)"
        syntax="app/gallery/[id]/page.tsx"
        description="인터셉트되지 않은 경우의 전체 페이지입니다. 소프트 네비게이션에서는 @modal/(.)gallery/[id]가 대신 렌더링됩니다."
        docsUrl="https://nextjs.org/docs/app/building-your-application/routing/intercepting-routes"
      />
    </div>
  )
}
