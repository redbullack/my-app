import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getDeptSitesCached } from '@/lib/appRegistry'

export async function proxy(request: NextRequest) {
    const token = await getToken({ req: request, secret: process.env.AUTH_SECRET })
    const isLoggedIn = !!token

    const hasKrFlag = true
    const hasJpFlag = true
    const hasCnFlag = true

    const tempRole = 'ADMIN'
    const tempAppIds = 'A001,A002,A003'

    // test
    console.log(`SERVER: proxy.ts - token.name: ${token?.name} / isLoggedIn: ${isLoggedIn}`)

    // appId, deptSite 추출
    const { pathname, search } = request.nextUrl
    const splitPathname = pathname.slice(1).split('/')
    const appId = splitPathname[0]
    const deptSite = splitPathname.length > 1 ? splitPathname[1] : null

    // 비로그인 유저 차단: 원래 가려던 경로를 callbackUrl로 넘겨 로그인 후 복귀
    if (!isLoggedIn) {
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('callbackUrl', pathname + search)
        return NextResponse.redirect(loginUrl)
    }

    // A00000 넘버링 페이지가 아니면 관여하지 않음
    if (!/^A\d{3}/.test(appId)) return NextResponse.next();

    // deptSite 정보가 없으면 플래그 우선순위(KR→JP→CN)로 default deptSite 결정
    if (!deptSite) {
        const defaultDept = hasKrFlag ? 'KR' : hasJpFlag ? 'JP' : 'CN'
        return NextResponse.redirect(new URL(`/${appId}/${defaultDept}${search}`, request.url))
    }

    // 로그인 상태에서 /login 접근 시 /dashboard로 리다이렉트
    if (pathname === '/login' && isLoggedIn) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // appId 가 지원하는 deptSite 확인
    // const deptSites = getDeptSites(appId)
    const deptSites = await getDeptSitesCached(appId)
    if (!deptSites.includes(deptSite as 'KR' | 'JP' | 'CN')) {
        // return new NextResponse('Not Found', { status: 404 })
        return NextResponse.rewrite(new URL('/_not-found', request.url), { status: 404 })
    }

    // deptSite 권한 확인
    const hasDeptSiteFlag =
        (deptSite === 'KR' && hasKrFlag) ||
        (deptSite === 'JP' && hasJpFlag) ||
        (deptSite === 'CN' && hasCnFlag)

    if (!hasDeptSiteFlag) return new NextResponse('Forbidden Test. . .', { status: 403 })

    // appId 권한: ADMIN은 전체 허용, USER는 appIds('A001,A002,...')에 포함될 때만 허용
    const hasAppIdFlag =
        tempRole === 'ADMIN' || (tempAppIds.split(',').includes(appId) ?? false)
    if (!hasAppIdFlag) return new NextResponse('Forbidden', { status: 403 })

    // deptSite 세그먼트가 있으면 평평한 폴더로 rewrite (주소창은 그대로)
    // 서버(Server Component/Action)에서 화면 컨텍스트를 읽을 수 있도록 request 헤더로 주입
    if (appId && deptSite) {
        const requestHeaders = new Headers(request.headers)
        requestHeaders.set('x-app-id', appId)
        requestHeaders.set('x-dept-site', deptSite)
        return NextResponse.rewrite(new URL(`/${appId}`, request.url), {
            request: { headers: requestHeaders },
        })
    }

    const response = NextResponse.next()

    // 기존 커스텀 응답 헤더 유지
    response.headers.set('x-app-name', 'nextjs-16-lab')
    response.headers.set('x-pathname', pathname)
    response.headers.forEach((v, k) => {
        console.log(`SERVER: proxy.ts - k: ${k}, v: ${v}`)
    })
    
    return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth|login).*)'],
}
