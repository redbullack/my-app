/**
 * @module lib/utils/client/unwrapEnvelope
 * @description
 * 공용 Controls 컴포넌트(Grid / InputSelect / Chart 등)가 `dataSource` props 를
 * "값 | Promise | 함수 | envelope 포함/미포함" 어떤 형태로 받든 동일하게 흡수하기 위한 헬퍼.
 *
 * 컴포넌트는 자신의 도메인 타입(T)이 무엇이든 (행 배열, 옵션 배열, 차트 포인트, {columns,rows} 등)
 * `resolveDataSource(props.dataSource)` 한 줄로 `Promise<T>` 를 얻으면 된다.
 *
 * 실패 경로:
 *  - ActionResponse.isSuccess === false 면 ActionError → AppError 로 복원 후
 *    handleGlobalError() 1회 호출 + AppError throw.
 *  - throw 된 AppError 는 컴포넌트 외곽의 Suspense/ErrorBoundary 가 받는다.
 *  - handleGlobalError 는 UI 피드백(Toast 등) 만 담당하므로, 컴포넌트는 별도 try/catch 가 없으면
 *    자동으로 "토스트 + 폴백 UI" 동작이 보장된다.
 */
import { AppError, type ActionError, type ActionResponse } from '../type'
import { handleGlobalError } from './globalErrorHandler'

/* ───────────────── 타입 정의 ───────────────── */

type MaybePromise<T> = T | Promise<T>

/**
 * 공용 컴포넌트의 dataSource props 표준 타입.
 *
 * 허용되는 입력 형태:
 *  - 동기 값: `T`
 *  - 비동기 값: `Promise<T>`
 *  - 무인자 함수(동기/비동기): `() => MaybePromise<T>`
 *  - 위 모든 경우의 envelope(`ActionResponse<T>`) 포함 형태 — Server Action 직접 주입 대응.
 *
 * 사용 예 (컴포넌트 props 정의):
 *   interface GridProps<T>        { dataSource: DataSource<T[]> }
 *   interface InputSelectProps<O> { dataSource: DataSource<O[]> }
 *   interface ChartProps<P>       { dataSource: DataSource<{ series: P[] }> }
 */
export type DataSource<T> =
    | MaybePromise<T | ActionResponse<T>>
    | (() => MaybePromise<T | ActionResponse<T>>)

/* ───────────────── 타입 가드 ───────────────── */

/** 임의 값이 ActionResponse envelope 인지 판별. */
export function isActionResponse<T>(v: unknown): v is ActionResponse<T> {
    return (
        typeof v === 'object' &&
        v !== null &&
        'isSuccess' in v &&
        typeof (v as { isSuccess: unknown }).isSuccess === 'boolean'
    )
}

/* ───────────────── 핵심 동기 언래핑 ───────────────── */

/**
 * resolve 된 값(envelope 또는 raw)을 받아 raw 값으로 변환한다.
 * - envelope 성공 → data 반환
 * - envelope 실패 → ActionError 를 AppError 로 복원 → handleGlobalError 호출 → AppError throw
 * - envelope 아님 → 그대로 반환
 *
 * 동기 함수다. Promise 체인 안에서 `.then(unwrapEnvelope)` 형태로 사용하거나,
 * 이미 await 된 값에 사용한다.
 */
export function unwrapEnvelope<T>(value: T | ActionResponse<T>): T {
    if (!isActionResponse<T>(value)) return value as T

    if (value.isSuccess) return value.data

    const appError = toAppError(value.error)
    handleGlobalError(appError)
    throw appError
}

/* ───────────────── 컴포넌트 1-stop API ───────────────── */

/**
 * 공용 컴포넌트가 호출하는 단일 진입점.
 * 어떤 형태의 dataSource 든 동일하게 `Promise<T>` 로 정규화하여 반환한다.
 *
 * 컴포넌트 내부에서 React 19 `use()` 또는 `await` 로 소비할 수 있다.
 *
 * @example
 * // Grid 내부
 * const dataPromise = resolveDataSource(props.dataSource)
 * const rows = use(dataPromise)
 *
 * @example
 * // InputSelect 내부 (useEffect 패턴)
 * useEffect(() => {
 *   resolveDataSource(props.dataSource).then(setOptions)
 * }, [props.dataSource])
 */
export function resolveDataSource<T>(src: DataSource<T>): Promise<T> {
    // Server Action 을 함수째 받은 경우, 렌더 중 직접 호출 시 Router setState 경고가
    // 발생할 수 있으므로 microtask 로 한 박자 지연시켜 호출한다.
    const raw: MaybePromise<T | ActionResponse<T>> =
        typeof src === 'function'
            ? Promise.resolve().then(() => (src as () => MaybePromise<T | ActionResponse<T>>)())
            : src

    return Promise.resolve(raw).then(unwrapEnvelope)
}

/* ───────────────── 내부 ───────────────── */

/** ActionError(plain) → AppError(class) 복원. */
function toAppError(err: ActionError): AppError {
    return new AppError(err)
}
