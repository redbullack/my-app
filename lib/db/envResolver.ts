/**
 * @module lib/db/envResolver
 * @description
 * 환경변수 `DB_CONNECTION__<NAME>` 에서 DB 접속 정보를 해석한다.
 *
 * 값은 JSON 문자열이며 `providerName` + ADO.NET 스타일 `connectionString` 으로 구성된다.
 * 예시 (.env.local):
 * ```
 * DB_CONNECTION__MAIN={"providerName":"oracle","connectionString":"User ID=scott;Password=tiger;Data Source=localhost:1521/xe;Min Pool Size=100;Max Pool Size=1000;Pool Increment=10"}
 * DB_CONNECTION__ANALYTICS={"providerName":"postgres","connectionString":"User ID=app;Password=secret;Data Source=localhost:5432/analytics;Min Pool Size=10;Max Pool Size=200"}
 * ```
 *
 * factory(db.ts) 가 유일한 호출자이며, 한 파일 안에서 provider 분기를 단순하게 유지하기 위해
 * 본 파일은 "환경변수 → 구조체" 변환만 담당한다.
 */

export type ProviderName = 'oracle' | 'postgres'

export interface ResolvedDsn {
  user: string
  password: string
  /** oracle: `host:port/service`, postgres: `host:port/database` */
  connectString: string
}

export interface PoolOptions {
  min?: number
  max?: number
  increment?: number
  timeout?: number
  queueTimeout?: number
}

export interface EnvResolveResult {
  providerName: ProviderName
  dsn: ResolvedDsn
  pool: PoolOptions
}

export function resolveFromEnv(name: string): EnvResolveResult | null {
  const raw = process.env[`DB_CONNECTION__${name}`]
  if (!raw) return null

  let dbConfig: { providerName?: string; connectionString?: string }
  try {
    dbConfig = JSON.parse(raw)
  } catch {
    throw new Error(`DB_CONNECTION__${name} 환경변수의 JSON 파싱 실패`)
  }

  const providerName = (dbConfig.providerName ?? 'oracle') as ProviderName
  if (providerName !== 'oracle' && providerName !== 'postgres') {
    throw new Error(`DB_CONNECTION__${name}: 지원되지 않는 providerName "${providerName}"`)
  }
  if (!dbConfig.connectionString) {
    throw new Error(`DB_CONNECTION__${name} 에 connectionString 이 없습니다`)
  }

  return parseAdoConnectionString(name, providerName, dbConfig.connectionString)
}

function parseAdoConnectionString(
  name: string,
  providerName: ProviderName,
  connectionString: string,
): EnvResolveResult {
  let user: string | undefined
  let password: string | undefined
  let connectString: string | undefined
  let poolMin: number | undefined
  let poolMax: number | undefined
  let poolIncrement: number | undefined

  for (const part of connectionString.split(';')) {
    const eqIdx = part.indexOf('=')
    if (eqIdx < 0) continue
    const key = part.slice(0, eqIdx).trim().toLowerCase()
    const value = part.slice(eqIdx + 1).trim()
    if (!key) continue

    if (key === 'user id' || key === 'user') user = value
    else if (key === 'password') password = value
    else if (key === 'data source' || key === 'server') connectString = value
    else if (key === 'min pool size' || key === 'poolmin') poolMin = parseInt(value, 10)
    else if (key === 'max pool size' || key === 'poolmax') poolMax = parseInt(value, 10)
    else if (key === 'pool increment') poolIncrement = parseInt(value, 10)
  }

  if (!user || !password || !connectString) {
    throw new Error(
      `DB_CONNECTION__${name}: connectionString 에 User ID, Password, Data Source 가 모두 필요합니다`,
    )
  }
  console.log(`TEST - envResolver.ts - name: ${name}, poolMin: ${poolMin}, poolMax:${poolMax}, poolIncrement: ${poolIncrement}`)
  return {
    providerName,
    dsn: { user, password, connectString },
    pool: {
      min: poolMin ?? 10,
      max: poolMax ?? 100,
      increment: poolIncrement ?? 1
    }
  }
}
