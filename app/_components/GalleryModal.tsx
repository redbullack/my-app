/**
 * @pattern Private Folder (_components)
 * @description
 * 앞에 _를 붙인 폴더는 라우팅에서 제외된다.
 * app/_components/ 는 app 디렉토리 내부에서 공유하는 컴포넌트를 담지만
 * 라우트로 해석되지 않는다.
 *
 * 이 컴포넌트는 Intercepting Routes에서 모달 UI를 제공한다.
 */
'use client'

import { useRouter } from 'next/navigation'
import { Modal, Badge } from '@/components/control'

interface GalleryItem {
  id: string
  title: string
  color: string
  description: string
}

export default function GalleryModal({ item }: { item: GalleryItem }) {
  const router = useRouter()

  return (
    <Modal isOpen onClose={() => router.back()} title={item.title}>
      <div className="space-y-4">
        <div className={`h-48 rounded-lg ${item.color}`} />
        <p className="text-text-secondary">{item.description}</p>
        <Badge variant="info">ID: {item.id}</Badge>
        <p className="text-xs text-text-muted">
          이 모달은 Intercepting Route (.)gallery/[id]를 통해 렌더링됩니다.
          새로고침하면 전체 페이지 /gallery/[id]로 이동합니다.
        </p>
      </div>
    </Modal>
  )
}
