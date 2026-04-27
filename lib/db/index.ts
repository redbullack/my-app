/**
 * @module lib/db
 * @description
 * DB 레이어의 **유일한 공개 표면**(public barrel). 프레임워크 외부(서버 액션·라우트 핸들러)는
 * 반드시 이 모듈만 import 하며, `lib/db/*` 하위 경로로 직접 들어오지 않는다.
 *
 * 사용 예:
 * ```ts
 * import { getDb } from '@/lib/db'
 * const db = getDb('MAIN')
 * const { columns, rows } = await db.query<Emp>('SELECT * FROM emp WHERE deptno = :d', { d: 10 })
 * ```
 */

import { getDb } from './factory'
import type { IDbClient } from './types'

export { getDb }
export { warmupDb } from './factory'
export { DbError, SAFE_PUBLIC_MESSAGE, type DbErrorCategory } from './errors'
export type {
  IDbClient,
  ITxClient,
  BindParams,
  QueryOptions,
  ExecuteResult,
  PoolOptions,
  QueryResult,
} from './types'

/**
 * @deprecated `getDb('MAIN')` 을 직접 사용하세요. 마이그레이션 완료 후 제거됩니다.
 *
 * 기존 호출 지점이 무수정으로 동작하도록 유지하는 호환 shim.
 */
export function getDbClient(): IDbClient {
  return getDb('MAIN')
}
