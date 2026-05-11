/**
 * @module lib/db/providers
 * @description
 * 프로바이더 어댑터 레지스트리.
 * 신규 프로바이더(예: postgres) 추가 시 어댑터를 작성한 뒤 본 파일에 등록한다.
 */

import type { IDbProvider, ProviderName } from '../types'
import { mssqlProvider } from './mssql'
import { oracleProvider } from './oracle'
import { postgresProvider } from './postgres'

const providers: Record<ProviderName, IDbProvider> = {
  oracle: oracleProvider,
  postgres: postgresProvider,
  mssql: mssqlProvider,
}

export function getProvider(name: ProviderName): IDbProvider {
  const p = providers[name]
  if (!p) throw new Error(`Unsupported DB provider: ${name}`)
  return p
}

/** factory 의 종료 훅에서 호출. 모든 프로바이더의 모든 풀을 close 한다. */
export async function closeAllProviders(): Promise<void> {
  await Promise.all(Object.values(providers).map((p) => p.closeAll()))
}
