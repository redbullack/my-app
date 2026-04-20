/**
 * @module lib/db/factory-new
 * @description
 * `getDb(name)` — 환경변수 전용 DB 팩토리.
 *
 * 기존 `factory.ts` 와 동일한 lifecycle(로깅·에러 래핑·캐싱·종료 훅)을 제공하되,
 * 접속 정보를 오직 `.env.local` 의 `DB_CONNECTION__<NAME>` 환경변수에서만 해석한다.
 * `databases` 레지스트리·`secret.ts` 암호화에 대한 의존이 없다.
 *
 * 호출 예시:
 * ```ts
 * import { getDb } from '@/lib/db/factory-new'
 * const rows = await getDb('MAIN').query<MyRow>('SELECT ...')
 * ```
 */

import { randomUUID } from 'node:crypto'
import { DbError } from './errors'
import { getDbLogger } from './logger'
import { closeAllProviders, getProvider } from './providers'
import { resolveFromEnv } from './resolvers/env'
import type {
  BindParams,
  ExecuteResult,
  IDbClient,
  ProviderName,
  QueryOptions,
  QueryResult
} from './types'

const clientCache = new Map<string, IDbClient>()

/**
 * 모든 query/execute 의 공통 lifecycle.
 * 시간 측정·로깅·DbError 변환을 한 지점에서 수행.
 */
async function withLifecycle<R>(
  args: {
    dbName: string
    provider: ProviderName
    sql: string
    binds: BindParams
    opts: QueryOptions
    op: 'query' | 'execute' | 'transaction'
  },
  run: (traceId: string) => Promise<R>,
  countRows?: (r: R) => number,
): Promise<R> {
  const traceId = args.opts.traceId ?? randomUUID()
  const log = getDbLogger()
  const start = Date.now()

  try {
    const result = await run(traceId)
    const durationMs = Date.now() - start
    log.info('db.ok', {
      db: args.dbName,
      provider: args.provider,
      op: args.op,
      traceId,
      durationMs,
      sql: args.sql,
      binds: args.binds,
      rowCount: countRows ? countRows(result) : undefined,
    })
    return result
  } catch (err) {
    const durationMs = Date.now() - start
    if (err instanceof DbError) {
      log.error('db.err', {
        db: args.dbName,
        provider: args.provider,
        op: args.op,
        traceId,
        durationMs,
        sql: args.sql,
        binds: args.binds,
        category: err.category,
        code: err.code,
        devMessage: err.devMessage,
        cause: err.cause instanceof Error ? err.cause.message : String(err.cause ?? ''),
      })
      throw err
    }
    const wrapped = new DbError({
      category: 'unknown',
      traceId,
      cause: err,
      devMessage: 'Unhandled error in DB lifecycle',
    })
    log.error('db.err', {
      db: args.dbName,
      provider: args.provider,
      op: args.op,
      traceId,
      durationMs,
      sql: args.sql,
      binds: args.binds,
      category: 'unknown',
      cause: err instanceof Error ? err.message : String(err),
    })
    throw wrapped
  }
}

/**
 * 환경변수 전용 DB 팩토리.
 * @param name 환경변수 `DB_CONNECTION__<name>` 에 대응하는 DB 식별자.
 */
export function getDb(name: string = "MAIN"): IDbClient {
  const cached = clientCache.get(name)
  if (cached) return cached

  const envResult = resolveFromEnv(name)
  if (!envResult) {
    throw new DbError({
      category: 'config',
      devMessage: `환경변수 DB_CONNECTION__${name} 이 설정되지 않았습니다`,
    })
  }

  const { providerName, dsn, pool } = envResult
  const provider = getProvider(providerName)

  const client: IDbClient = {
    query<T>(sql: string, binds: BindParams = {}, opts: QueryOptions = {}): Promise<QueryResult<T>> {
      return withLifecycle(
        { dbName: name, provider: providerName, sql, binds, opts, op: 'query' },
        (traceId) =>
          provider.query<T>(name, dsn, pool, sql, binds, { ...opts, traceId }),
        // (rows) => (Array.isArray(rows) ? rows.length : 0),
        (r) => r.rows.length,
      )
    },

    execute<T>(
      sql: string,
      binds: BindParams = {},
      opts: QueryOptions = {},
    ): Promise<ExecuteResult<T>> {
      return withLifecycle(
        { dbName: name, provider: providerName, sql, binds, opts, op: 'execute' },
        (traceId) =>
          provider.execute<T>(name, dsn, pool, sql, binds, { ...opts, traceId }),
        (r) => r.rowsAffected,
      )
    },

    transaction<R>(fn: (tx: IDbClient) => Promise<R>): Promise<R> {
      return withLifecycle(
        {
          dbName: name,
          provider: providerName,
          sql: 'TRANSACTION',
          binds: {},
          opts: {},
          op: 'transaction',
        },
        () => provider.withTransaction(name, dsn, pool, fn),
      )
    },
  }

  clientCache.set(name, client)
  return client
}

// ─── 프로세스 종료 훅 ──────────────────────────────────────────────
const HOOK_FLAG = '__myapp_db_new_exit_hook__'
{
  const g = globalThis as unknown as Record<string, boolean | undefined>
  if (!g[HOOK_FLAG]) {
    g[HOOK_FLAG] = true
    const close = () => {
      void closeAllProviders()
    }
    process.once('beforeExit', close)
    process.once('SIGINT', close)
    process.once('SIGTERM', close)
  }
}
