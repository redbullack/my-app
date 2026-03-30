/**
 * @route /gallery
 * @pattern Intercepting Routes — 갤러리 목록
 * @description
 * 갤러리 목록 페이지. 각 아이템을 Link로 클릭하면
 * @modal/(.)gallery/[id] 인터셉터가 동작하여 모달로 표시된다.
 * URL 직접 입력이나 새로고침 시에는 /gallery/[id]/page.tsx 전체 페이지가 렌더링된다.
 */
import Link from 'next/link'
import { SAMPLE_GALLERY } from '@/lib/constants'
import { Badge } from '@/components/control'
import RouteInfo from '@/components/shared/RouteInfo'

export default function GalleryPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold text-text-primary">Gallery</h1>
      <p className="mt-2 text-text-secondary">
        아이템을 클릭하면 <Badge variant="info">Intercepting Route</Badge>로 모달이 표시됩니다.
        새로고침하면 전체 페이지로 이동합니다.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {SAMPLE_GALLERY.map(item => (
          <Link key={item.id} href={`/gallery/${item.id}`}>
            <div className="group cursor-pointer overflow-hidden rounded-xl border border-border transition-all hover:border-accent/50 hover:shadow-lg">
              <div className={`h-40 ${item.color} transition-transform group-hover:scale-105`} />
              <div className="bg-bg-primary p-3">
                <h3 className="font-medium text-text-primary">{item.title}</h3>
                <p className="text-xs text-text-muted">{item.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <RouteInfo
        pattern="Intercepting Routes"
        syntax="app/@modal/(.)gallery/[id]/page.tsx"
        description="(.)는 같은 세그먼트 레벨을 가로챕니다. Link 클릭 시 모달로, 직접 URL 접근 시 전체 페이지로 렌더링됩니다."
        docsUrl="https://nextjs.org/docs/app/building-your-application/routing/intercepting-routes"
      />
    </div>
  )
}
