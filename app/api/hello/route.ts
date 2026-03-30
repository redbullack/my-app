/**
 * @route /api/hello
 * @pattern Route Handler
 * @description
 * Route Handler는 app/api 폴더 내의 route.ts 파일로 정의한다.
 * HTTP 메서드명(GET, POST 등)으로 export하면 해당 메서드의 핸들러가 된다.
 *
 * Next.js 16에서 GET Route Handler는 기본적으로 dynamic (캐싱 안 됨).
 * force-static으로 변경하려면 export const dynamic = 'force-static' 사용.
 *
 * Request 객체는 Web API의 Request를 확장한 NextRequest를 사용할 수 있다.
 */
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    message: '안녕하세요! 이것은 Route Handler 응답입니다.',
    timestamp: new Date().toISOString(),
    pattern: 'app/api/hello/route.ts → GET',
  })
}

export async function POST(request: Request) {
  const body = await request.json()
  return NextResponse.json({
    message: 'POST 요청을 받았습니다.',
    received: body,
    timestamp: new Date().toISOString(),
  })
}
