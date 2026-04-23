/**
 * @module lib/utils/server/actionWrapper
 * @description
 * 모든 Server Action 을 감싸 `ActionResponse<T>` envelope 으로 직렬화하는 고차 함수.
 *
 * 팀원 규칙:
 *  - Server Action 내부에 try/catch 를 쓰지 않는다 (래퍼가 담당).
 *  - 정상 경로만 작성 → 예외는 래퍼가 ActionError 로 분류·envelope.
 *
 * 요청 컨텍스트(ALS):
 *  - 액션 진입 시 세션(auth) + referer(pagePath) + 액션 단위 traceId 를 runWithRequestContext 로 주입.
 *  - 하위 DB 호출(withLifecycle) 과 로거가 파라미터 없이 동일 컨텍스트를 읽는다.
 *
 * traceId 통합:
 *  - 액션 단위 traceId 는 ALS 에 1개 존재. DB 로그는 이를 parentTraceId 로 참조.
 *  - unknown 에러 fallback 에서도 새로 생성하지 않고 ALS traceId 를 재사용 → 같은 요청 안의 모든 로그가 동일 traceId 로 묶임.
 *
 * 중복 로깅 방지:
 *  - DbError 는 withLifecycle 이 이미 db.err 이벤트로 로깅했으므로 재로깅 없음.
 *  - 그 외 Error 는 여기서 server.action 이벤트로 1회 로깅.
 */
import { randomUUID } from 'node:crypto'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth/auth'
import { DbError, type DbErrorCategory } from '@/lib/db'
import type { ActionResponse, ActionError, ErrorType } from '../type'
import { runWithRequestContext, getRequestContext, type RequestContext } from './requestContext'

/** DbError.category → ActionError.type */
const DB_CATEGORY_MAP: Record<DbErrorCategory, ErrorType> = {
    constraint: 'db_constraint',
    permission: 'db_permission',
    config: 'db_system',
    connection: 'db_system',
    syntax: 'db_system',
    timeout: 'db_system',
    unknown: 'db_system',
}

/**
 * Server Action 래퍼.
 *
 * @example
 * export const fetchEmpList = (cond: EmpSearchCond) =>
 *   actionAgent('fetchEmpList', async () => {
 *     return getDb('MAIN').query<EmpRow>(SQL, binds)
 *   })
 */
export async function actionAgent<T>(
    name: string,
    fn: () => Promise<T>,
): Promise<ActionResponse<T>> {
    const ctx = await buildRequestContext(name)

    return runWithRequestContext(ctx, async () => {
        try {
            const data = await fn()
            return { isSuccess: true, data }
        } catch (err) {
            return { isSuccess: false, error: toActionError(err, name) }
        }
    })
}

/**
 * 세션·헤더를 읽어 요청 컨텍스트를 구성한다.
 * auth()/headers() 가 실패해도 액션 실행은 막지 않는다(세션 누락 허용).
 */
async function buildRequestContext(actionName: string): Promise<RequestContext> {
    const traceId = randomUUID()
    console.log(`SERVER: buildRequestContext - traceId: ${traceId}`)
    let userId: string | undefined
    let userName: string | undefined
    let role: string | undefined
    let empno: number | undefined
    try {
        const session = await auth()
        if (session?.user) {
            userId = session.user.id
            userName = session.user.name
            role = session.user.role
            empno = session.user.empno
        }
    } catch {
        // 세션 조회 실패는 무시 — 비로그인/로그인 플로우도 액션을 호출할 수 있다.
    }

    let pagePath: string | undefined
    try {
        const h = await headers()
        pagePath = h.get('referer') ?? h.get('next-url') ?? undefined
    } catch {
        // headers() 사용 불가 컨텍스트(예: 테스트) 대비.
    }

    return { traceId, userId, userName, role, empno, actionName, pagePath, loggable: true }
}

function toActionError(err: unknown, actionName: string): ActionError {
    // ── 1) DB 에러 ──
    if (err instanceof DbError) {
        return {
            type: DB_CATEGORY_MAP[err.category] ?? 'db_system',
            message: err.message,
            code: err.code,
            traceId: err.traceId,
            devMessage:
                process.env.NODE_ENV === 'development' ? err.devMessage : undefined,
        }
    }

    // ── 2) 인증 에러 (예: 세션 만료 커스텀 에러) ──
    // if (err instanceof AuthError) {
    //     return { type: 'auth', message: '로그인이 필요합니다.', traceId: getRequestContext().traceId ?? randomUUID() }
    // }

    // ── 3) 유효성 검증 에러 (예: zod/yup validation) ──
    // if (err instanceof ZodError) {
    //     return { type: 'validation', message: err.issues[0].message, traceId: getRequestContext().traceId ?? randomUUID() }
    // }

    // ── 4) fetch 타임아웃 (예: AbortController signal 만료) ──
    // if (err instanceof DOMException && err.name === 'AbortError') {
    //     return { type: 'timeout', message: '요청 시간이 초과되었습니다.', traceId: getRequestContext().traceId ?? randomUUID() }
    // }

    // ── 5) 외부 API 호출 실패 (예: fetch wrapper 에러) ──
    // if (err instanceof FetchError) {
    //     return { type: 'network', message: '외부 서비스 연결에 실패했습니다.', traceId: getRequestContext().traceId ?? randomUUID() }
    // }

    // ── 6) 미분류 에러 → unknown fallback ──
    // traceId 통합: 같은 요청의 DB 로그/액션 로그가 동일 traceId 로 묶이도록 ALS 값을 재사용.
    const ctx = getRequestContext()
    const traceId = ctx.traceId ?? randomUUID()
    const message = err instanceof Error ? err.message : String(err)
    console.error(
        JSON.stringify({
            ts: new Date().toISOString(),
            level: 'error',
            scope: 'server.action',
            event: 'action.error',
            action: actionName,
            traceId,
            userId: ctx.userId,
            userName: ctx.userName,
            role: ctx.role,
            empno: ctx.empno,
            pagePath: ctx.pagePath,
            errorName: err instanceof Error ? err.name : 'Unknown',
            errorMessage: message,
            stack:
                process.env.NODE_ENV === 'development' && err instanceof Error
                    ? err.stack
                    : undefined,
        }),
    )

    return {
        type: 'unknown',
        message: '요청 처리 중 오류가 발생했습니다.',
        traceId,
        devMessage: process.env.NODE_ENV === 'development' ? message : undefined,
    }
}
