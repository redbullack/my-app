/**
 * @module lib/utils/server/requestContext
 * @description
 * 현재 요청의 인증 사용자 정보 + 페이지 경로를 로깅 용도로 조회한다.
 *
 * 설계 원칙:
 *  - **절대 throw 하지 않는다.** 세션이 없는 컨텍스트(예: next-auth 의 authorize 콜백 안)
 *    에서도 호출 가능해야 하므로, 못 읽으면 해당 필드를 비운 채 Partial 을 돌려준다.
 *  - 그 덕분에 auth.ts 가 별도 `getSysDb` 같은 우회 함수 없이 일반 `getDb` 를 쓸 수 있고,
 *    로그인 도중 쿼리는 사용자 필드가 비어 있는 채로 정상 로깅된다 (의미상 정확한 상태).
 *  - auth() / headers() 는 Next.js 가 요청당 캐싱하므로 호출 단위로 매번 부르는 비용은 무시할 만하다.
 */

import { headers } from 'next/headers'
import { auth } from '@/lib/auth/auth'

export interface RequestCtx {
    userId?: string
    userName?: string
    role?: string
    empno?: number
    /** 호출이 발생한 페이지 경로(referer 기반, 없으면 undefined). */
    pagePath?: string
}

export async function getRequestCtx(): Promise<RequestCtx> {
    let userFields: RequestCtx = {}
    try {
        const session = await auth()
        const u = session?.user as
            | { id: string; name: string; role: string; empno: number }
            | undefined
        if (u) {
            userFields = {
                userId: u.id,
                userName: u.name,
                role: u.role,
                empno: u.empno,
            }
        }
    } catch {
        // auth 인프라 부재/장애 — 로깅에서 사용자 정보만 비고 비즈니스 쿼리는 계속 진행.
    }

    let pagePath: string | undefined
    try {
        const h = await headers()
        pagePath = h.get('referer') ?? h.get('next-url') ?? undefined
    } catch {
        // headers() 사용 불가 컨텍스트(예: 단위 테스트) 대비.
    }

    return { ...userFields, pagePath }
}
