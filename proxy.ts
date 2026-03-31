/**
 * @pattern Proxy + Authentication
 * @description
 * Next.js 16의 proxy.ts (구 middleware.ts)에 NextAuth v5 인증 체크를 통합한다.
 * - Next.js 16에서 middleware.ts → proxy.ts로 이름이 변경되고 Node.js 런타임 전용으로 강화됨
 * - 보호 경로(/dashboard, /settings, /emp): 미인증 시 /login으로 리다이렉트
 * - /login: 인증 상태면 /dashboard로 리다이렉트
 * - 기존 커스텀 헤더(x-app-name, x-pathname) 유지
 *
 * getToken()으로 JWT를 직접 검증한다.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const PROTECTED_PATHS = ['/dashboard', '/settings', '/emp']

export async function proxy(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.AUTH_SECRET })
  const { pathname } = request.nextUrl
  const isLoggedIn = !!token

  // 보호 경로: 미인증 시 /login으로 리다이렉트
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p))
  if (isProtected && !isLoggedIn) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 로그인 상태에서 /login 접근 시 /dashboard로 리다이렉트
  if (pathname === '/login' && isLoggedIn) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  const response = NextResponse.next()

  // 기존 커스텀 응답 헤더 유지
  response.headers.set('x-app-name', 'nextjs-16-lab')
  response.headers.set('x-pathname', pathname)

  return response
}

/**
 * matcher: 정적 파일과 NextAuth API를 제외한 모든 경로에 적용
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
}
