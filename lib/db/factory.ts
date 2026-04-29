/**
 * @module lib/db/factory
 * @description
 * `getDb(name)` — 환경변수 전용 DB 팩토리. DB 레이어의 메인 진입점.
 *
 * 접속 정보는 오직 `.env.local` 의 `DB_CONNECTION__<NAME>` 환경변수에서만 해석된다.
 * 모든 query/execute/tx 는 `withLifecycle` 로 감싸 traceId/시간 측정/
 * 성공·실패 로그/DbError 변환을 한 곳에서 처리한다. 클라이언트는 DB 이름별로 1회 캐싱된다.
 *
 * ## 트랜잭션 모델 (ALS 기반)
 *
 * `db.tx(async () => { ... })` 호출은 모듈 스코프 `AsyncLocalStorage` (`txStore`) 에 트랜잭션
 * 상태를 저장한다. 콜백 안에서 같은 `db` 의 `query/execute` 를 호출하면 ALS 컨텍스트에서
 * raw 커넥션을 꺼내 provider 로 전달하므로, 호출자는 별도의 `tx` 인자를 받을 필요가 없다.
 *
 * - 동일 DB 의 중첩 `tx()` 호출은 런타임에 차단된다.
 * - 다른 DB 의 `tx()` 는 자유롭게 중첩 가능하며 각자 독립적으로 commit/rollback 된다.
 *   ⚠️ 분산 트랜잭션(XA) 이 아니므로, 자식 tx 가 commit 된 후 부모 tx 가 rollback 되면
 *   자식 변경은 보존된다. 강한 원자성이 필요하면 단일 DB 안에서 작업을 모아야 한다.
 * - `closing` 플래그로 commit/rollback 진행 후의 잔여 호출을 차단한다.
 * - `inflight` 카운터로 await 누락(`forEach(async)`) 을 감지하여 자동 rollback 시킨다.
 *
 * 호출 예시:
 * ```ts
 * import { getDb } from '@/lib/db'
 * const db = getDb('MAIN')
 * await db.tx(async () => {
 *   await db.execute('UPDATE ...')
 *   await db.execute('UPDATE ...')
 * })
 * ```
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import { getRequestContext } from '@/lib/utils/server/requestContext'
import { DbError } from './errors'
import { getDbLogger } from './logger'
import { closeAllProviders, getProvider } from './providers'
import { resolveFromEnv } from './resolvers/env'
import type {
  BindParams,
  IDbClient,
  ProviderName,
  QueryOptions,
} from './types'

interface TxState {
  /** provider 별 raw 커넥션 (oracledb.Connection 등). provider 외부에서는 사용 금지. */
  conn: unknown
  traceId: string
  /** 진행 중 query/execute 카운터. tx 종료 시 0 이 아니면 await 누락으로 간주. */
  inflight: number
  /** commit/rollback 진행 중 플래그. 이 시점 이후 신규 호출은 차단. */
  closing: boolean
}

/** dbName → TxState. ALS 스코프별로 독립. */
const txStore = new AsyncLocalStorage<Map<string, TxState>>()

/**
 * 클라이언트 캐시. dev HMR 환경에서 factory 모듈이 재평가되어도 동일 인스턴스를 재사용하기 위해
 * globalThis 에 보관한다(oracle 풀 캐시와 동일 패턴).
 */
const CLIENT_CACHE_KEY = '__myapp_db_client_cache__'
function getClientCache(): Map<string, IDbClient> {
  const g = globalThis as unknown as Record<string, Map<string, IDbClient> | undefined>
  if (!g[CLIENT_CACHE_KEY]) g[CLIENT_CACHE_KEY] = new Map()
  return g[CLIENT_CACHE_KEY]!
}

/**
 * DB 이름 화이트리스트.
 * 환경변수 키(`DB_CONNECTION__<NAME>`) 의 일부로 그대로 합성되므로,
 * 외부 입력이 흘러들어와 임의 환경변수를 prove 하는 표면을 만들지 않도록
 * 형식을 강하게 제한한다(대문자/숫자/언더스코어, 첫 글자 영문).
 */
const DB_NAME_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/
function assertValidDbName(name: string): void {
  if (!DB_NAME_PATTERN.test(name)) {
    throw new DbError({
      category: 'config',
      devMessage: `잘못된 DB 이름: "${name}". 대문자로 시작하고 [A-Z0-9_] 만 허용됩니다(최대 64자).`,
    })
  }
}

/**
 * 외부에서 전달된 옵션을 공개 필드(maxRows/timeoutMs)만 남기도록 정제한다.
 * `conn`/`traceId`/`parentTraceId` 같은 internal 메타가 caller 의 우회로 주입되어
 * provider 까지 흘러가는 것을 차단한다.
 */
function pickPublicOpts(opts: QueryOptions): QueryOptions {
  const out: QueryOptions = {}
  if (typeof opts.maxRows === 'number') out.maxRows = opts.maxRows
  if (typeof opts.timeoutMs === 'number') out.timeoutMs = opts.timeoutMs
  return out
}

/**
 * 모든 query/execute/tx 의 공통 lifecycle.
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
  const traceId = randomUUID()
  const log = getDbLogger()
  const start = Date.now()

  // 요청 컨텍스트(ALS) — actionAgent 에서 주입된 세션/액션/페이지 정보.
  // 스코프 바깥에서 호출되는 경우(예: warmup) 빈 객체로 안전하게 동작.
  const reqCtx = getRequestContext()

  // parentTraceId 우선순위:
  //   1) 트랜잭션 ALS 의 tx traceId (동일 DB 의 tx 안인 경우)
  //   2) 액션 단위 traceId (요청 ALS)
  const txState = txStore.getStore()?.get(args.dbName)
  const parentTraceId = txState?.traceId ?? reqCtx.traceId

  const ctxFields = {
    actionName: reqCtx.actionName,
    pagePath: reqCtx.pagePath,
    userId: reqCtx.userId,
    userName: reqCtx.userName,
    role: reqCtx.role,
    empno: reqCtx.empno,
  }

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
 * 환경변수 전용 DB 팩토리.
 * @param name 환경변수 `DB_CONNECTION__<name>` 에 대응하는 DB 식별자.
 */
export function getDb(name: string = 'MAIN'): IDbClient {
  // assertValidDbName(name)
  const clientCache = getClientCache()
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
    query<T>(sql: string, binds: BindParams = {}, opts: QueryOptions = {}) {
      const safeOpts = pickPublicOpts(opts)
      return withLifecycle(
        { dbName: name, provider: providerName, sql, binds, opts: safeOpts, op: 'query' },
        async (traceId) => {
          const st = txStore.getStore()?.get(name)
          if (st) {
            if (st.closing) {
              throw new DbError({
                category: 'config',
                devMessage: 'tx 스코프가 이미 종료(closing) 상태입니다 — commit/rollback 이후의 호출은 허용되지 않습니다.',
              })
            }
            st.inflight++
            try {
              return await provider.query<T>(name, dsn, pool, sql, binds, {
                ...safeOpts,
                traceId,
                conn: st.conn,
              })
            } finally {
              st.inflight--
            }
          }
          return provider.query<T>(name, dsn, pool, sql, binds, { ...safeOpts, traceId })
        },
        (r) => r.rows.length,
      )
    },

    execute<T>(sql: string, binds: BindParams = {}, opts: QueryOptions = {}) {
      const safeOpts = pickPublicOpts(opts)
      return withLifecycle(
        { dbName: name, provider: providerName, sql, binds, opts: safeOpts, op: 'execute' },
        async (traceId) => {
          const st = txStore.getStore()?.get(name)
          if (st) {
            if (st.closing) {
              throw new DbError({
                category: 'config',
                devMessage: 'tx 스코프가 이미 종료(closing) 상태입니다 — commit/rollback 이후의 호출은 허용되지 않습니다.',
              })
            }
            st.inflight++
            try {
              return await provider.execute<T>(name, dsn, pool, sql, binds, {
                ...safeOpts,
                traceId,
                conn: st.conn,
              })
            } finally {
              st.inflight--
            }
          }
          return provider.execute<T>(name, dsn, pool, sql, binds, { ...safeOpts, traceId })
        },
        (r) => r.rowsAffected,
      )
    },

    tx<R>(fn: () => Promise<R>): Promise<R> {
      return withLifecycle(
        {
          dbName: name, provider: providerName, sql: 'TRANSACTION',
          binds: {}, opts: {}, op: 'transaction',
        },
        async (txTraceId) => {
          const parent = txStore.getStore()
          if (parent?.get(name)) {
            throw new DbError({
              category: 'config',
              devMessage: '동일 DB 의 중첩 트랜잭션은 지원하지 않습니다. 단일 tx 콜백 안에서 모든 query/execute 를 수행하세요.',
            })
          }

          const conn = await provider.acquireTxConnection(name, dsn, pool)
          const state: TxState = { conn, traceId: txTraceId, inflight: 0, closing: false }
          // 다중 DB 트랜잭션을 위해 부모 Map 을 복사 후 동일 dbName 만 덮어쓴다.
          const next = new Map(parent ?? [])
          next.set(name, state)

          try {
            const result = await txStore.run(next, fn)
            if (state.inflight > 0) {
              throw new DbError({
                category: 'config',
                devMessage: 'tx 종료 시점에 in-flight 쿼리가 남아 있습니다 — await 누락(예: forEach(async)) 을 의심하세요.',
              })
            }
            state.closing = true
            await provider.commit(conn)
            return result
          } catch (err) {
            state.closing = true
            try {
              await provider.rollback(conn)
            } catch {
              /* rollback 실패는 원본 에러를 가리지 않도록 무시 */
            }
            throw err
          } finally {
            try {
              await provider.release(conn)
            } catch {
              /* noop */
            }
          }
        },
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
  // assertValidDbName(name)
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
