/**
 * @module lib/db/resolvers/env
 * @description
 * 환경변수 `DB_CONNECTION__<NAME>` 에서 DB 접속 정보를 해석하는 resolver.
 *
 * 환경변수 값은 JSON 객체 문자열이며, `connectionString` 필드를
 * ADO.NET 스타일 세미콜론 구분자로 파싱하여 `ResolvedDsn` + `PoolOptions` 를 반환한다.
 *
 * 예시 (.env.local):
 * ```
 * DB_CONNECTION__MAIN={"providerName":"oracle","connectionString":"User ID=scott;Password=tiger;Data Source=localhost:1521/xe;Min Pool Size=2;Max Pool Size=10;Pool Increment=1"}
 * ```
 */

import { DbError } from '../errors'
import type { PoolOptions, ProviderName, ResolvedDsn } from '../types'

export interface EnvResolveResult {
  providerName: ProviderName
  dsn: ResolvedDsn
  pool: PoolOptions
}

/**
 * 환경변수 `DB_CONNECTION__<name>` 에서 접속 정보를 해석한다.
 * 환경변수가 없으면 `null` 을 반환하여 기존 레지스트리 폴백을 유도한다.
 */
export function resolveFromEnv(name: string): EnvResolveResult | null {
  const raw = process.env[`DB_CONNECTION__${name}`]
  if (!raw) return null

  let dbConfig: { providerName?: string; connectionString?: string }
  try {
    dbConfig = JSON.parse(raw)
  } catch {
    throw new DbError({
      category: 'config',
      devMessage: `DB_CONNECTION__${name} 환경변수의 JSON 파싱 실패`,
    })
  }

  const providerName: ProviderName = (dbConfig.providerName as ProviderName) ?? 'oracle'

  if (!dbConfig.connectionString) {
    throw new DbError({
      category: 'config',
      devMessage: `DB_CONNECTION__${name} 에 connectionString 이 없습니다`,
    })
  }

  if (providerName === 'oracle' || dbConfig.connectionString) {
    return parseAdoConnectionString(name, providerName, dbConfig.connectionString)
  }

  throw new DbError({
    category: 'config',
    devMessage: `DB_CONNECTION__${name}: 지원되지 않는 providerName "${providerName}"`,
  })
}

/**
 * ADO.NET 스타일 connectionString 파싱.
 * `Key=Value;Key2=Value2` 형태를 `ResolvedDsn` + `PoolOptions` 로 변환한다.
 * key 는 소문자 변환하여 비교하고, value 는 원본을 유지한다.
 */
function parseAdoConnectionString(
  name: string,
  providerName: ProviderName,
  connectionString: string,
): EnvResolveResult {
  const parts = connectionString.split(';')

  let user: string | undefined
  let password: string | undefined
  let connectString: string | undefined
  let poolMin: number | undefined
  let poolMax: number | undefined
  let poolIncrement: number | undefined

  for (const part of parts) {
    const eqIdx = part.indexOf('=')
    if (eqIdx < 0) continue

    const key = part.slice(0, eqIdx).trim().toLowerCase()
    const value = part.slice(eqIdx + 1).trim()

    if (!key) continue

    if (key === 'user id' || key === 'user') {
      user = value
    } else if (key === 'password') {
      password = value
    } else if (key === 'data source' || key === 'server') {
      connectString = value
    } else if (key === 'min pool size' || key === 'poolmin') {
      poolMin = parseInt(value, 10) || 100
    } else if (key === 'max pool size' || key === 'poolmax') {
      poolMax = parseInt(value, 10) || 100
    } else if (key === 'pool increment') {
      poolIncrement = parseInt(value, 10) || 1
    }
  }

  if (!user || !password || !connectString) {
    throw new DbError({
      category: 'config',
      devMessage: `DB_CONNECTION__${name}: connectionString 에서 User ID, Password, Data Source 가 모두 필요합니다`,
    })
  }

  return {
    providerName,
    dsn: { user, password, connectString },
    pool: {
      min: poolMin ?? 100,
      max: poolMax ?? 100,
      increment: poolIncrement ?? 1,
    },
  }
}
