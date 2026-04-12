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
 *
 * ─────────────────────────────────────────────────────────────────────
 * [현업 활용 패턴 가이드] proxy.ts에서 처리할 수 있는 대표적 역할들
 * ─────────────────────────────────────────────────────────────────────
 *
 * ■ 1. 인증/인가 (Authentication & Authorization)
 *   - JWT/세션 토큰 검증 후 미인증 사용자 리다이렉트
 *   - Role-based Access Control (RBAC): 토큰 내 role 필드로 관리자 전용 경로 차단
 *   - 예시:
 *     const ADMIN_PATHS = ['/admin', '/manage']
 *     if (ADMIN_PATHS.some(p => pathname.startsWith(p)) && token?.role !== 'admin') {
 *       return NextResponse.redirect(new URL('/403', request.url))
 *     }
 *
 * ■ 2. 국제화 (i18n) 리다이렉트
 *   - Accept-Language 헤더 또는 쿠키 기반으로 locale prefix 자동 부여
 *   - 예시:
 *     const locale = request.cookies.get('NEXT_LOCALE')?.value
 *       || request.headers.get('accept-language')?.split(',')[0]?.split('-')[0]
 *       || 'ko'
 *     if (!pathname.startsWith(`/${locale}`)) {
 *       return NextResponse.redirect(new URL(`/${locale}${pathname}`, request.url))
 *     }
 *   ⚠ 주의: locale 판별 로직이 복잡해지면(IP 기반 GeoIP 조회 등) 응답 지연 발생.
 *     GeoIP는 CDN/Edge 레벨에서 헤더로 주입받는 것이 바람직하다.
 *
 * ■ 3. A/B 테스트 / Feature Flag 라우팅
 *   - 쿠키로 실험 그룹을 할당하고, 그룹별로 다른 페이지로 rewrite
 *   - 예시:
 *     let bucket = request.cookies.get('ab-experiment')?.value
 *     if (!bucket) {
 *       bucket = Math.random() < 0.5 ? 'control' : 'variant'
 *       const res = NextResponse.rewrite(new URL(`/${bucket}${pathname}`, request.url))
 *       res.cookies.set('ab-experiment', bucket, { maxAge: 60 * 60 * 24 * 30 })
 *       return res
 *     }
 *     return NextResponse.rewrite(new URL(`/${bucket}${pathname}`, request.url))
 *
 * ■ 4. Bot / Crawler 감지 및 분기
 *   - User-Agent로 검색엔진 봇을 감지하여 SEO 전용 페이지로 rewrite
 *   - 악성 봇 차단 (간단한 UA 기반 블로킹)
 *   - 예시:
 *     const ua = request.headers.get('user-agent') || ''
 *     const isBot = /Googlebot|Bingbot|Slurp|DuckDuckBot|Baiduspider/i.test(ua)
 *     if (isBot && pathname.startsWith('/spa-heavy')) {
 *       return NextResponse.rewrite(new URL(`/prerendered${pathname}`, request.url))
 *     }
 *     // 알려진 악성 봇 차단
 *     const isBlocked = /SemrushBot|AhrefsBot|MJ12bot/i.test(ua)
 *     if (isBlocked) {
 *       return new NextResponse(null, { status: 403 })
 *     }
 *
 * ■ 5. Rate Limiting (간이)
 *   - IP 기반 요청 빈도를 Map/외부 스토어로 추적하여 제한
 *   - 예시 (인메모리 — 단일 인스턴스에서만 유효):
 *     const rateMap = new Map<string, { count: number; resetAt: number }>()
 *     const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
 *     const now = Date.now()
 *     const entry = rateMap.get(ip)
 *     if (entry && now < entry.resetAt) {
 *       if (entry.count > 100) {
 *         return new NextResponse('Too Many Requests', { status: 429 })
 *       }
 *       entry.count++
 *     } else {
 *       rateMap.set(ip, { count: 1, resetAt: now + 60_000 })
 *     }
 *   ⚠ 주의: 인메모리 Map은 서버 인스턴스 간 공유되지 않으므로 다중 인스턴스 환경에서는
 *     Redis/Upstash 등 외부 스토어를 사용해야 한다. 외부 I/O가 추가되면
 *     모든 요청의 latency가 증가하므로 반드시 벤치마크 후 도입한다.
 *
 * ■ 6. 지역/국가 기반 라우팅 (Geo Routing)
 *   - Vercel 등 플랫폼이 주입하는 x-vercel-ip-country 헤더 활용
 *   - 예시:
 *     const country = request.headers.get('x-vercel-ip-country') || 'KR'
 *     if (country === 'CN' && pathname.startsWith('/app')) {
 *       return NextResponse.redirect(new URL('/cn-app' + pathname, request.url))
 *     }
 *
 * ■ 7. 보안 헤더 주입 (Security Headers)
 *   - CSP, HSTS, X-Frame-Options 등을 모든 응답에 일괄 적용
 *   - 예시:
 *     const response = NextResponse.next()
 *     response.headers.set('X-Frame-Options', 'DENY')
 *     response.headers.set('X-Content-Type-Options', 'nosniff')
 *     response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
 *     response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains')
 *     response.headers.set(
 *       'Content-Security-Policy',
 *       "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
 *     )
 *     return response
 *
 * ■ 8. URL Rewrite (마이크로서비스 프록시)
 *   - 특정 경로를 외부 서비스 URL로 투명하게 프록시
 *   - 클라이언트는 동일 도메인으로 요청하므로 CORS 문제 회피
 *   - 예시:
 *     if (pathname.startsWith('/api/legacy')) {
 *       return NextResponse.rewrite(
 *         new URL(pathname.replace('/api/legacy', ''), 'https://legacy-api.internal.company.com')
 *       )
 *     }
 *
 * ■ 9. 요청/응답 로깅 & 트레이싱
 *   - 요청마다 trace-id를 생성하여 헤더에 주입 → 분산 추적에 활용
 *   - 예시:
 *     const traceId = crypto.randomUUID()
 *     const response = NextResponse.next({
 *       request: { headers: new Headers({ ...Object.fromEntries(request.headers), 'x-trace-id': traceId }) }
 *     })
 *     response.headers.set('x-trace-id', traceId)
 *     return response
 *   ⚠ 주의: 로깅을 위해 외부 서비스(DataDog, Sentry 등)로 HTTP 호출을 보내면
 *     모든 요청에 네트워크 왕복이 추가된다. 로그는 비동기 버퍼링하거나
 *     stdout으로 출력 후 별도 로그 수집기가 처리하는 것이 좋다.
 *
 * ■ 10. 유지보수 모드 (Maintenance Mode)
 *   - 환경변수 플래그 하나로 전체 사이트를 점검 페이지로 전환
 *   - 예시:
 *     if (process.env.MAINTENANCE_MODE === 'true' && !pathname.startsWith('/maintenance')) {
 *       return NextResponse.rewrite(new URL('/maintenance', request.url))
 *     }
 *
 * ■ 11. 리다이렉트 맵 (Legacy URL Migration)
 *   - 구 URL → 신 URL 매핑 테이블로 대량 301 리다이렉트 처리
 *   - 예시:
 *     const REDIRECT_MAP: Record<string, string> = {
 *       '/old-blog': '/blog',
 *       '/old-about': '/about',
 *       '/products/legacy': '/shop',
 *     }
 *     const destination = REDIRECT_MAP[pathname]
 *     if (destination) {
 *       return NextResponse.redirect(new URL(destination, request.url), 301)
 *     }
 *   ⚠ 주의: 리다이렉트 맵이 수천 건 이상이면 proxy.ts 로드 시 메모리 소비가 커지고
 *     매 요청마다 탐색 비용이 발생한다. 대규모 리다이렉트는 next.config.js의
 *     redirects 설정이나 CDN 레벨에서 처리하는 것이 더 효율적이다.
 *
 * ─────────────────────────────────────────────────────────────────────
 * [proxy.ts 성능 주의사항]
 * ─────────────────────────────────────────────────────────────────────
 *
 * proxy.ts는 매칭되는 모든 요청의 "입구"에서 실행되므로, 여기서의 지연은
 * 전체 응답 시간에 직접 영향을 준다. 다음 원칙을 지킨다:
 *
 * 1. 외부 I/O 최소화
 *    - DB 조회, 외부 API 호출, Redis 조회 등은 반드시 필요한 경우에만 수행한다.
 *    - 가능하면 JWT에 필요한 정보를 클레임으로 포함시켜 토큰 디코딩만으로 판단한다.
 *    - 외부 호출이 불가피하면 타임아웃(예: 500ms)을 설정하고, 실패 시 통과(fail-open)
 *      또는 차단(fail-close) 정책을 명확히 정한다.
 *
 * 2. 무거운 연산 금지
 *    - 대용량 JSON 파싱, 정규식 폭발(ReDoS 위험), 암호화/복호화 등은 피한다.
 *    - CPU 바운드 작업이 필요하면 Route Handler나 Server Action으로 위임한다.
 *
 * 3. matcher를 적극 활용하여 불필요한 실행 방지
 *    - 정적 파일(_next/static, favicon 등)은 반드시 matcher에서 제외한다.
 *    - API 라우트 중 인증이 불필요한 공개 엔드포인트도 제외를 검토한다.
 *    - matcher로 범위를 좁힐수록 proxy 함수 자체가 호출되는 횟수가 줄어든다.
 *
 * 4. 조건 분기는 빠른 탈출(early return) 구조로 작성
 *    - 가장 빈번한 경로(정상 통과)를 먼저 처리하여 불필요한 조건 평가를 줄인다.
 *
 * 5. 로직이 비대해지면 분리 고려
 *    - proxy.ts가 200줄을 넘거나 관심사가 3개 이상이면, 각 역할을 모듈로 분리하고
 *      proxy.ts에서는 파이프라인처럼 순차 호출하는 구조를 권장한다.
 *    - 예시:
 *      import { handleAuth } from '@/lib/proxy/auth'
 *      import { handleI18n } from '@/lib/proxy/i18n'
 *      import { handleSecurity } from '@/lib/proxy/security'
 *
 *      export async function proxy(request: NextRequest) {
 *        const authResult = await handleAuth(request)
 *        if (authResult) return authResult
 *
 *        const i18nResult = handleI18n(request)
 *        if (i18nResult) return i18nResult
 *
 *        const response = NextResponse.next()
 *        handleSecurity(response)
 *        return response
 *      }
 *
 * ─────────────────────────────────────────────────────────────────────
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
 *
 * matcher 최적화 팁:
 * - 이미지, 폰트, 정적 자산 경로를 반드시 제외하여 불필요한 proxy 실행을 방지한다.
 * - 공개 API 엔드포인트(/api/public/*)도 인증이 불필요하면 제외를 검토한다.
 * - matcher 패턴이 많아지면 배열로 관리하되, 정규식 복잡도를 낮게 유지한다.
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
}
