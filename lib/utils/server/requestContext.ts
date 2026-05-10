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
 *
 * 로그 분리 정책:
 *  - 프레임워크 내부 쿼리(NextAuth 세션 조회, warmup) 는 getSysDb / provider.warmup 으로
 *    withLifecycle 자체를 우회하므로 자동으로 로그에서 제외된다.
 *  - withLifecycle 이 실제로 실행되는 경로는 모두 actionAgent 컨텍스트(인증된 사용자 액션)뿐이며
 *    전부 로깅 대상이다. 별도의 loggable 플래그는 두지 않는다.
 *
 * 불변성:
 *  - 컨텍스트는 actionAgent 진입 시 1회 세팅 후 변경되지 않는다.
 *  - 하위 코드가 ALS 값을 함부로 바꾸지 못하도록 readonly 로 노출한다.
 *
 * 주의:
 *  - DB 로거(OracleDbLogger) 에서 getRequestContext() 로 읽어 INSERT 에 사용한다.
 *  - ALS.run() 스코프 바깥에서 호출되면 빈 객체가 반환된다(로거는 null 허용 설계).
 */

import { AsyncLocalStorage } from 'node:async_hooks'

export interface RequestContext {
    readonly traceId: string
    readonly userId?: string
    readonly userName?: string
    readonly role?: string
    readonly empno?: number
    readonly actionName?: string
    readonly pagePath?: string
}

const storage = new AsyncLocalStorage<RequestContext>()

/** 컨텍스트를 세팅하고 fn 을 실행. 내부에서 일어나는 모든 비동기 호출은 같은 컨텍스트 공유. */
export function runWithRequestContext<T>(
    ctx: RequestContext,
    fn: () => Promise<T>,
): Promise<T> {
    // 깊은 freeze 는 비용/형태 보존 측면에서 과하므로 최상위만 freeze 한다.
    // 인터페이스 readonly 와 결합되어 컴파일/런타임 양쪽에서 변형을 차단한다.
    return storage.run(Object.freeze({ ...ctx }), fn)
}

/** 현재 컨텍스트 조회. 스코프 바깥이면 빈 객체. */
export function getRequestContext(): Readonly<Partial<RequestContext>> {
    return storage.getStore() ?? {}
}
