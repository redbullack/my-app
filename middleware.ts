/**
 * @pattern Middleware
 * @description
 * Next.js Middleware는 요청이 라우트에 도달하기 전에 실행된다.
 * 프로젝트 루트(또는 src/)에 middleware.ts 파일을 생성하면 자동 적용된다.
 *
 * 주요 용도:
 * - 인증/인가 체크
 * - 리다이렉트/리라이트
 * - 요청/응답 헤더 수정
 * - A/B 테스트, 지역화(i18n) 등
 *
 * config.matcher: 미들웨어가 실행될 경로 패턴을 지정한다.
 * 아래 예제는 모든 요청에 커스텀 헤더를 추가하고, 요청 정보를 로깅한다.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // 커스텀 응답 헤더 추가 (데모)
  response.headers.set('x-app-name', 'nextjs-16-lab')
  response.headers.set('x-pathname', request.nextUrl.pathname)

  return response
}

/**
 * matcher: 미들웨어가 적용될 경로 패턴.
 * - /((?!_next/static|_next/image|favicon.ico).*) : 정적 파일을 제외한 모든 경로
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
