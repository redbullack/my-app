/**
 * @module lib/utils/server/requestContext
 * @description
 * Server Action 단위 요청 스코프 컨텍스트. Node.js AsyncLocalStorage 기반.
 *
 * 진입점(actionAgent)에서 1회 세팅 → 하위 비동기 호출(getDb, withLifecycle, logger 등)이
 * 파라미터 전달 없이 같은 컨텍스트를 읽는다. 요청 간 격리는 ALS 가 보장.
 *
 * 저장 항목:
 *  - traceId     : 액션 단위 최상위 traceId (DB lifecycle 의 parentTraceId 로도 사용)
 *  - userId      : session.user.id
 *  - userName    : session.user.name
 *  - role        : session.user.role (JOB)
 *  - empno       : session.user.empno
 *  - actionName  : actionAgent 의 첫 번째 인자
 *  - pagePath    : 호출이 발생한 페이지(referer 기반, 없으면 undefined)
 *  - loggable    : DB lifecycle 로그를 남길지 여부(opt-in). 프레임워크 내부 쿼리
 *                  (NextAuth 세션 조회, warmup 등)는 컨텍스트 자체가 없거나
 *                  loggable=false 이므로 자동으로 로그에서 제외된다.
 *                  사용자 유발 진입점(actionAgent / page / route handler wrapper)에서만 true 로 세팅한다.
 *
 * 주의:
 *  - DB 로거(OracleDbLogger) 에서 getRequestContext() 로 읽어 INSERT 에 사용한다.
 *  - ALS.run() 스코프 바깥에서 호출되면 빈 객체가 반환된다(로거는 null 허용 설계).
 */

import { AsyncLocalStorage } from 'node:async_hooks'

export interface RequestContext {
    traceId: string
    userId?: string
    userName?: string
    role?: string
    empno?: number
    actionName?: string
    pagePath?: string
    loggable?: boolean
}

const storage = new AsyncLocalStorage<RequestContext>()

/** 컨텍스트를 세팅하고 fn 을 실행. 내부에서 일어나는 모든 비동기 호출은 같은 컨텍스트 공유. */
export function runWithRequestContext<T>(
    ctx: RequestContext,
    fn: () => Promise<T>,
): Promise<T> {
    return storage.run(ctx, fn)
}

/** 현재 컨텍스트 조회. 스코프 바깥이면 빈 객체. */
export function getRequestContext(): Partial<RequestContext> {
    return storage.getStore() ?? {}
}
