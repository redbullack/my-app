/**
 * @route /gallery/[id] (intercepted)
 * @pattern Intercepting Routes — (.) 같은 레벨 가로채기
 * @description
 * 갤러리 상세 페이지를 모달로 가로채는 Intercepting Route.
 * (.) 접두사는 같은 세그먼트 레벨의 라우트를 가로챈다.
 * (..) 는 한 단계 위, (...) 는 루트 레벨을 가로챈다.
 *
 * 이 페이지는 소프트 네비게이션(Link 클릭) 시 모달로 표시되고,
 * 하드 네비게이션(URL 직접 입력/새로고침) 시에는 /gallery/[id]/page.tsx가 표시된다.
 *
 * Next.js 16: params는 Promise — 반드시 await 해야 한다.
 */
import { SAMPLE_GALLERY } from '@/lib/constants'
import GalleryModal from '@/app/_components/GalleryModal'

export default async function InterceptedGalleryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const item = SAMPLE_GALLERY.find(g => g.id === id)

  if (!item) return null

  return <GalleryModal item={item} />
}
