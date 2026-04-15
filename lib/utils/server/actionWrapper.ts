/**
 * @module lib/utils/server/actionWrapper
 * @description
 * 모든 Server Action 을 감싸 `ActionResponse<T>` envelope 으로 직렬화하는 고차 함수.
 *
 * 팀원 규칙:
 *  - Server Action 내부에 try/catch 를 쓰지 않는다 (래퍼가 담당).
 *  - 정상 경로만 작성 → 예외는 래퍼가 AppError 로 분류·envelope.
 *
 * 중복 로깅 방지:
 *  - DbError 는 withLifecycle 이 이미 db.err 이벤트로 로깅했으므로 재로깅 없음.
 *  - 그 외 Error 는 여기서 server.action 이벤트로 1회 로깅.
 */
import { randomUUID } from 'node:crypto'
import { DbError, type DbErrorCategory } from '@/lib/db/errors'
import type { ActionResponse, AppError, ErrorType } from '../type'

/** DbError.category → AppError.type */
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
    try {
        const data = await fn()
        return { isSuccess: true, data }
    } catch (err) {
        return { isSuccess: false, error: toAppError(err, name) }
    }
}

function toAppError(err: unknown, actionName: string): AppError {
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

    const traceId = randomUUID()
    const message = err instanceof Error ? err.message : String(err)
    console.error(
        JSON.stringify({
            ts: new Date().toISOString(),
            level: 'error',
            scope: 'server.action',
            event: 'action.error',
            action: actionName,
            traceId,
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
