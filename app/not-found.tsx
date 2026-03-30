/**
 * @pattern Not Found (404)
 * @description
 * 전역 404 페이지. 존재하지 않는 경로에 접근하거나
 * 컴포넌트에서 notFound()를 호출했을 때 렌더링된다.
 * app/not-found.tsx 파일은 앱 전체의 기본 404 UI를 정의한다.
 */
import Link from 'next/link'
import { Button, Panel } from '@/components/control'

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Panel variant="outlined" className="max-w-md text-center">
        <h1 className="text-6xl font-bold text-accent">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-text-primary">
          페이지를 찾을 수 없습니다
        </h2>
        <p className="mt-2 text-text-secondary">
          요청하신 경로가 존재하지 않습니다. URL을 확인해주세요.
        </p>
        <div className="mt-6">
          <Link href="/">
            <Button variant="primary">홈으로 돌아가기</Button>
          </Link>
        </div>
      </Panel>
    </div>
  )
}
