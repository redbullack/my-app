/**
 * @route /api/revalidate
 * @pattern Route Handler — On-demand Revalidation
 * @description
 * 온디맨드 캐시 갱신(revalidation) 엔드포인트.
 * revalidatePath()나 revalidateTag()를 호출하여
 * 특정 경로나 태그의 캐시를 무효화한다.
 *
 * 실제 운영에서는 webhook이나 CMS 이벤트에서 이 엔드포인트를 호출하여
 * 콘텐츠 변경 시 자동으로 캐시를 갱신한다.
 */
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

export async function POST(request: Request) {
  const body = await request.json()
  const path = body.path as string | undefined

  if (!path) {
    return NextResponse.json(
      { error: 'path 필드가 필요합니다.' },
      { status: 400 },
    )
  }

  revalidatePath(path)

  return NextResponse.json({
    revalidated: true,
    path,
    timestamp: new Date().toISOString(),
  })
}
