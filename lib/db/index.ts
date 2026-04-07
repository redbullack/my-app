/**
 * @module lib/db
 * @description
 * DB 레이어 public barrel.
 *
 * 신규 코드는 `getDb('NAME')` 사용 — `lib/db/config/databases.ts` 에 등록된 이름의 literal 만 허용.
 * 기존 호출지(`getDbClient()`) 는 단계적 마이그레이션 동안만 호환 shim 으로 동작.
 *
 * 사용 예:
 * ```ts
 * import { getDb } from '@/lib/db'
 * const db = getDb('MAIN')
 * const rows = await db.query<Emp>('SELECT * FROM emp WHERE deptno = :d', { d: 10 })
 * ```
 */

export { getDb } from './factory'
export { DbError, SAFE_PUBLIC_MESSAGE, type DbErrorCategory } from './errors'
export type { DbName } from './config/databases'
export type {
  IDbClient,
  BindParams,
  QueryOptions,
  ExecuteResult,
  PoolOptions,
  ProviderName,
} from './types'

import { getDb } from './factory'
import type { IDbClient } from './types'

/**
 * @deprecated `getDb('MAIN')` 을 직접 사용하세요. 마이그레이션 완료 후 제거됩니다.
 *
 * 기존 9개 호출 지점이 무수정으로 동작하도록 유지하는 호환 shim.
 */
export function getDbClient(): IDbClient {
  return getDb('MAIN')
}
