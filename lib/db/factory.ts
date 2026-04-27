/**
 * @module lib/db/factory
 * @description
 * `getDb(name)` — 환경변수 전용 DB 팩토리. DB 레이어의 메인 진입점.
 *
 * 접속 정보는 오직 `.env.local` 의 `DB_CONNECTION__<NAME>` 환경변수에서만 해석된다.
 * 모든 query/execute/transaction 은 `withLifecycle` 로 감싸 traceId/시간 측정/
 * 성공·실패 로그/DbError 변환을 한 곳에서 처리한다. 클라이언트는 DB 이름별로 1회 캐싱된다.
 *
 * 호출자(서버 액션·라우트 핸들러)는 `@/lib/db` barrel 의 `getDb` 만 사용한다.
 *
 * 호출 예시:
 * ```ts
 * import { getDb } from '@/lib/db'
 * const rows = await getDb('MAIN').query<MyRow>('SELECT ...')
 * ```
 */

import { randomUUID } from 'node:crypto'
import { getRequestContext } from '@/lib/utils/server/requestContext'
import { DbError } from './errors'
import { getDbLogger } from './logger'
import { closeAllProviders, getProvider } from './providers'
import { resolveFromEnv } from './resolvers/env'
import type {
  BindParams,
  ExecuteResult,
  IDbClient,
  ITxClient,
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

  // 요청 컨텍스트(ALS) — actionAgent 에서 주입된 세션/액션/페이지 정보.
  // 스코프 바깥에서 호출되는 경우(예: warmup) 빈 객체로 안전하게 동작.
  const reqCtx = getRequestContext()

  // traceId 통합: transaction 내부의 parentTraceId 가 명시되어 있으면 그대로,
  // 아니면 액션 단위 traceId(ALS) 를 parentTraceId 로 사용.
  const parentTraceId = args.opts.parentTraceId ?? reqCtx.traceId

  // 모든 로그 라인에 공통으로 부착될 요청 컨텍스트 필드.
  const ctxFields = {
    actionName: reqCtx.actionName,
    pagePath: reqCtx.pagePath,
    userId: reqCtx.userId,
    userName: reqCtx.userName,
    role: reqCtx.role,
    empno: reqCtx.empno,
  }

  // 로깅 opt-in: actionAgent / withPageContext / withRouteContext 등 사용자 유발 진입점에서만 true.
  // NextAuth 세션 조회, warmup 등 프레임워크 내부 쿼리는 이 플래그가 없어 자동으로 로그에서 제외된다.
  const loggable = reqCtx.loggable === true

  try {
    const result = await run(traceId)
    const durationMs = Date.now() - start
    if (loggable) log.info('db.ok', {
      db: args.dbName,
      provider: args.provider,
      op: args.op,
      traceId,
      parentTraceId,
      durationMs,
      sql: args.sql,
      binds: args.binds,
      rowCount: countRows ? countRows(result) : undefined,
      ...ctxFields,
    })
    return result
  } catch (err) {
    const durationMs = Date.now() - start
    const alreadyLogged =
      err instanceof DbError &&
      (err as DbError & { __loggedByLifecycle?: boolean }).__loggedByLifecycle === true

    if (err instanceof DbError) {
      if (!alreadyLogged && loggable) {
        log.error('db.err', {
          db: args.dbName,
          provider: args.provider,
          op: args.op,
          traceId,
          parentTraceId,
          durationMs,
          sql: args.sql,
          binds: args.binds,
          category: err.category,
          code: err.code,
          devMessage: err.devMessage,
          cause: err.cause instanceof Error ? err.cause.message : String(err.cause ?? ''),
          ...ctxFields,
        })
          ; (err as DbError & { __loggedByLifecycle?: boolean }).__loggedByLifecycle = true
      } else if (args.op === 'transaction' && loggable) {
        // 하위 쿼리에서 이미 로깅되었더라도, 트랜잭션 단위 실패 집계를 위해 요약 1줄 추가.
        log.error('db.err', {
          db: args.dbName,
          provider: args.provider,
          op: 'transaction',
          traceId,
          parentTraceId,
          durationMs,
          sql: args.sql,
          category: err.category,
          code: err.code,
          devMessage: err.devMessage,
          cause: err.cause instanceof Error ? err.cause.message : String(err.cause ?? ''),
          ...ctxFields,
        })
      }
      throw err
    }
    const wrapped = new DbError({
      category: 'unknown',
      traceId,
      cause: err,
      devMessage: 'Unhandled error in DB lifecycle',
    })
    if (loggable) {
      log.error('db.err', {
        db: args.dbName,
        provider: args.provider,
        op: args.op,
        traceId,
        parentTraceId,
        durationMs,
        sql: args.sql,
        binds: args.binds,
        category: 'unknown',
        cause: err instanceof Error ? err.message : String(err),
        ...ctxFields,
      })
        ; (wrapped as DbError & { __loggedByLifecycle?: boolean }).__loggedByLifecycle = true
    }
    throw wrapped
  }
}

/**
 * query/execute 를 withLifecycle 로 감싼 ITxClient 를 생성한다.
 * 외부 클라이언트와 트랜잭션 내부 클라이언트 모두 이 함수로 만든다.
 * parentTraceId 를 넘기면 내부 쿼리 로그가 트랜잭션 단위로 묶인다.
 */
function makeClient(
  name: string,
  providerName: ProviderName,
  raw: Pick<ITxClient, 'query' | 'execute'>,
  parentTraceId?: string,
): ITxClient {
  return {
    query<T>(sql: string, binds: BindParams = {}, opts: QueryOptions = {}): Promise<QueryResult<T>> {
      return withLifecycle(
        {
          dbName: name, provider: providerName, sql, binds,
          opts: parentTraceId ? { ...opts, parentTraceId } : opts,
          op: 'query'
        },
        (traceId) => raw.query<T>(sql, binds, { ...opts, traceId }),
        (r) => r.rows.length,
      )
    },
    execute<T>(sql: string, binds: BindParams = {}, opts: QueryOptions = {}): Promise<ExecuteResult<T>> {
      return withLifecycle(
        {
          dbName: name, provider: providerName, sql, binds,
          opts: parentTraceId ? { ...opts, parentTraceId } : opts,
          op: 'execute'
        },
        (traceId) => raw.execute<T>(sql, binds, { ...opts, traceId }),
        (r) => r.rowsAffected,
      )
    },
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
    ...makeClient(name, providerName, {
      query: (sql, binds, opts) => provider.query(name, dsn, pool, sql, binds!, opts!),
      execute: (sql, binds, opts) => provider.execute(name, dsn, pool, sql, binds!, opts!),
    }),

    transaction<R>(fn: (tx: ITxClient) => Promise<R>): Promise<R> {
      const txTraceId = randomUUID()
      return withLifecycle(
        {
          dbName: name, provider: providerName, sql: 'TRANSACTION',
          binds: {}, opts: { traceId: txTraceId }, op: 'transaction'
        },
        () => provider.withTransaction(name, dsn, pool, (rawTx) =>
          fn(makeClient(name, providerName, rawTx, txTraceId))
        ),
      )
    },
  }

  clientCache.set(name, client)
  return client
}

/**
 * DB 풀을 선제적으로 생성한다(워밍업).
 * instrumentation.ts 의 server 부팅 훅에서 호출되어 첫 요청의 풀 생성 비용을 제거한다.
 * 이미 생성된 풀이 있으면 provider 내부 캐시가 no-op 처리한다.
 */
export async function warmupDb(name: string): Promise<void> {
  const envResult = resolveFromEnv(name)
  if (!envResult) {
    throw new DbError({
      category: 'config',
      devMessage: `환경변수 DB_CONNECTION__${name} 이 설정되지 않았습니다`,
    })
  }
  const { providerName, dsn, pool } = envResult
  const provider = getProvider(providerName)
  await provider.warmup(name, dsn, pool)
}

// ─── 프로세스 종료 훅 ──────────────────────────────────────────────
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
