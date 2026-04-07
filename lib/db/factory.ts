/**
 * @module lib/db/factory
 * @description
 * `getDb(name)` — DB 레이어의 메인 진입점.
 *
 * 책임:
 *  1) 레지스트리에서 DB 항목 조회 + connectString 복호화
 *  2) provider 어댑터 선택
 *  3) 모든 query/execute 를 `withLifecycle` 로 감싸 traceId/시간/성공·실패 로그/에러 변환을 한 곳에서 처리
 *  4) 클라이언트 인스턴스 캐싱 (DB 이름별 1회 생성)
 *  5) 프로세스 종료 훅 등록 (graceful pool drain)
 *
 * 호출자(서버 액션·라우트 핸들러)는 오직 이 모듈의 `getDb` 만 사용한다.
 */

import { randomUUID } from 'node:crypto'
import { databases, type DbName } from './config/databases'
import { DbError } from './errors'
import { bindShape, getDbLogger, sqlPreview } from './logger'
import { closeAllProviders, getProvider } from './providers'
import { parseOracleDsn } from './providers/oracle'
import { decryptConnectString, isEncryptedToken } from './secret'
import type {
  BindParams,
  DbConfigEntry,
  ExecuteResult,
  IDbClient,
  ProviderName,
  QueryOptions,
  ResolvedDsn,
} from './types'

const clientCache = new Map<DbName, IDbClient>()

/** DSN 파싱은 provider 별로 다를 수 있으나 현재는 oracle 한 종류. */
function resolveDsn(provider: ProviderName, plain: string): ResolvedDsn {
  switch (provider) {
    case 'oracle':
      return parseOracleDsn(plain)
    default:
      throw new DbError({
        category: 'config',
        devMessage: `DSN parser not implemented for provider: ${provider}`,
      })
  }
}

function resolveEntry(entry: DbConfigEntry): ResolvedDsn {
  const plain = entry.encrypt ? decryptConnectString(entry.connectString) : entry.connectString
  // 평문 항목인데 실수로 enc:v1 으로 시작하면 명확히 알려준다
  if (!entry.encrypt && isEncryptedToken(entry.connectString)) {
    throw new DbError({
      category: 'config',
      devMessage: 'connectString 이 enc: 토큰으로 보이지만 encrypt:false 입니다. encrypt:true 로 바꾸세요.',
    })
  }
  return resolveDsn(entry.providerName, plain)
}

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
    const durationMsOk = Date.now() - start
    log.info('db.ok', {
      db: args.dbName,
      provider: args.provider,
      op: args.op,
      traceId,
      durationMs: durationMsOk,
      // sql: sqlPreview(args.sql),
      // binds: bindShape(args.binds),
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
        // sql: sqlPreview(args.sql),
        // binds: bindShape(args.binds),
        sql: args.sql,
        binds: args.binds,
        category: err.category,
        code: err.code,
        devMessage: err.devMessage,
        cause: err.cause instanceof Error ? err.cause.message : String(err.cause ?? ''),
      })
      throw err
    }
    // provider 가 변환하지 않은 raw 에러 — 안전망
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
      // sql: sqlPreview(args.sql),
      // binds: bindShape(args.binds),
      sql: args.sql,
      binds: args.binds,
      category: 'unknown',
      cause: err instanceof Error ? err.message : String(err),
    })
    throw wrapped
  }
}

/**
 * DB 레이어의 메인 팩토리.
 * @param name 레지스트리에 등록된 DB 이름. 오타 시 컴파일 에러.
 */
export function getDb(name: DbName): IDbClient {
  const cached = clientCache.get(name)
  if (cached) return cached

  const entry = databases[name] as DbConfigEntry | undefined
  if (!entry) {
    throw new DbError({
      category: 'config',
      devMessage: `Unknown DB name: ${String(name)}`,
    })
  }

  const provider = getProvider(entry.providerName)

  // DSN 은 매 호출마다 새로 파싱하지 않고 lazy + 캐싱.
  // 단, 키 미설정 등 에러는 첫 query 시점에 명확히 표면화되어야 하므로 함수형으로.
  let resolved: ResolvedDsn | null = null
  function getResolved(): ResolvedDsn {
    if (resolved) return resolved
    resolved = resolveEntry(entry!)
    return resolved
  }

  const client: IDbClient = {
    query<T>(sql: string, binds: BindParams = {}, opts: QueryOptions = {}): Promise<T[]> {
      return withLifecycle(
        { dbName: name, provider: entry.providerName, sql, binds, opts, op: 'query' },
        (traceId) =>
          provider.query<T>(name, getResolved(), entry.pool, sql, binds, { ...opts, traceId }),
        (rows) => (Array.isArray(rows) ? rows.length : 0),
      )
    },

    execute<T>(
      sql: string,
      binds: BindParams = {},
      opts: QueryOptions = {},
    ): Promise<ExecuteResult<T>> {
      return withLifecycle(
        { dbName: name, provider: entry.providerName, sql, binds, opts, op: 'execute' },
        (traceId) =>
          provider.execute<T>(name, getResolved(), entry.pool, sql, binds, { ...opts, traceId }),
        (r) => r.rowsAffected,
      )
    },

    transaction<R>(fn: (tx: IDbClient) => Promise<R>): Promise<R> {
      return withLifecycle(
        {
          dbName: name,
          provider: entry.providerName,
          sql: 'TRANSACTION',
          binds: {},
          opts: {},
          op: 'transaction',
        },
        () => provider.withTransaction(name, getResolved(), entry.pool, fn),
      )
    },
  }

  clientCache.set(name, client)
  return client
}

// ─── 프로세스 종료 훅 ──────────────────────────────────────────────
// 1회만 등록. dev HMR 누수 방지로 globalThis 플래그 사용.
const HOOK_FLAG = '__myapp_db_exit_hook__'
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
