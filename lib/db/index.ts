/**
 * @module lib/db
 * @description
 * DB 클라이언트 팩토리.
 * DB_TYPE 환경변수(또는 인자)로 원하는 DB를 선택하면 해당 query 함수를 반환한다.
 * 현재는 'oracle'만 구현되어 있다.
 */

import { queryOracle } from './oracleClient'

export type DbType = 'oracle'

export interface DbClient {
  query: <T = Record<string, unknown>>(
    sql: string,
    binds?: unknown[],
  ) => Promise<T[]>
}

/**
 * DB 타입에 맞는 클라이언트를 반환하는 팩토리 함수.
 * @param type - 사용할 DB 종류 (기본값: 'oracle')
 */
export function getDbClient(type: DbType = 'oracle'): DbClient {
  switch (type) {
    case 'oracle':
      return {
        query: <T = Record<string, unknown>>(sql: string, binds: unknown[] = []) =>
          queryOracle<T>(sql, binds),
      }
    default:
      throw new Error(`Unsupported DB type: ${type}`)
  }
}

// 편의 re-export
export { queryOracle, getOracleConnection } from './oracleClient'
