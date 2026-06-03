import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getDeptSites } from '@/lib/appRegistry'
import { auth } from './lib/auth/auth'
// import { getToken } from 'next-auth/jwt'

export async function proxy(request: NextRequest) {
    const session = await auth()

    // appId, deptSite 추출
    const { pathname, search } = request.nextUrl
    const splitPathname = pathname.split('/').filter(Boolean)
    const appId = splitPathname[0]
    const deptSite = splitPathname.length > 1 ? splitPathname[1] : 'KR'

    console.log(`proxy.ts - 진입 ! pathname: ${pathname}, appId: ${appId}, deptSite: ${deptSite}`)
    console.log(`proxy.ts - userId: ${session?.user.userId}`)

    // 비로그인 유저 차단
    if (!session) {
        console.log(`proxy.ts - 끝 ! 비로그인 유저 차단. . .`)
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('callbackUrl', pathname + search)
        return NextResponse.redirect(loginUrl)
    }

    // 화면 진입 구분
    const isPrefetch = request.headers.get('next-router-prefetch') === '1' // <Link> 자동 prefetch
    const isServerAction = request.headers.has('next-action') // Server Action
    const isNavigation = !(isPrefetch || isServerAction)
    console.log(`proxy.ts - prefetch: ${request.headers.get('next-router-prefetch')} / next-action: ${request.headers.get('next-action')} / isNavigation: ${isNavigation}`)

    
    if (isNavigation) {
        // appId 가 지원하는 deptSite 확인
        const deptSites = await getDeptSites(appId)
        if (!deptSites.includes(deptSite as 'KR' | 'JP' | 'CN')) {
            console.log(`proxy.ts - 끝 ! deptSite 를 지원하지 않음. . . deptSite: ${deptSite} / deptSites: ${deptSites.join(',')}`)
            // return new NextResponse('Not Found', { status: 404 })
            return NextResponse.rewrite(new URL('/_not-found', request.url), { status: 404 })
        }

        // User 의 deptSite 권한 확인
        const hasDeptSiteFlag =
            (deptSite === 'KR' && session.user.hasKrFlag === 'Y') ||
            (deptSite === 'JP' && session.user.hasJpFlag === 'Y') ||
            (deptSite === 'CN' && session.user.hasCnFlag === 'Y')

        if (!hasDeptSiteFlag) {
            console.log(`proxy.ts - 끝 ! deptSite 권한이 없음. . . deptSite: ${deptSite} / KR: ${session.user.hasKrFlag}, JP: ${session.user.hasJpFlag}, CN: ${session.user.hasCnFlag}`)
            return new NextResponse('Forbidden Test. . .', { status: 403 })
        }
    }

    // rewrite (주소창은 그대로)
    console.log(`proxy.ts - 끝 ! 정상 라우팅 appId: ${appId}, deptSite: ${deptSite}`)
    console.log(`proxy.ts - ====================================================================================================`)
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-app-id', appId)
    requestHeaders.set('x-dept-site', deptSite)
    return NextResponse.rewrite(new URL(`/${appId}${search}`, request.url), {
        request: { headers: requestHeaders },
    })

}

export const config = {
//   matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth|login|\\.well-known).*)'],
  matcher: ['/([A-Za-z]\\d{5}(?:/.*)?)'],
}
