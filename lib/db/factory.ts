/**
 * @module lib/db/factory
 * @description
 * `getDb(name)` — 환경변수 전용 DB 팩토리. DB 레이어의 메인 진입점.
 *
 * 접속 정보는 오직 `.env.local` 의 `DB_CONNECTION__<NAME>` 환경변수에서만 해석된다.
 * 모든 query/execute/tx 는 `withLifecycle` 로 감싸 traceId/시간 측정/
 * 성공·실패 로그/DbError 변환을 한 곳에서 처리한다. 클라이언트는 DB 이름별로 1회 캐싱된다.
 *
 * ## 트랜잭션 모델 (ALS 기반, 단일 DB 전용)
 *
 * `db.tx(async () => { ... })` 호출은 모듈 스코프 `AsyncLocalStorage` (`txStore`) 에 트랜잭션
 * 상태를 저장한다. 콜백 안에서 같은 `db` 의 `query/execute` 를 호출하면 ALS 컨텍스트에서
 * raw 커넥션을 꺼내 provider 로 전달하므로, 호출자는 별도의 `tx` 인자를 받을 필요가 없다.
 *
 * tx 는 **단일 DB 단위** 로만 동작한다. 다음은 모두 런타임에 차단되며, 차단 시 부모 tx 는
 * 강제로 rollback 된다 (호출자가 try/catch 로 throw 를 삼켜도 동일).
 *
 * - 동일 DB 의 중첩 `tx()` 호출
 * - 다른 DB 의 중첩 `tx()` 호출 (다중 DB 트랜잭션 미지원 — XA 아님)
 * - tx 스코프 안에서 다른 DB 의 `query` / `execute` 호출
 *   (사일런트 auto-commit 으로 인한 부분 반영을 막기 위함)
 *
 * 그 외 안전 장치:
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
  /** 이 tx 스코프가 속한 DB 이름. 다른 DB 호출 차단을 위해 사용. */
  dbName: string
  /** provider 별 raw 커넥션 (oracledb.Connection 등). provider 외부에서는 사용 금지. */
  conn: unknown
  traceId: string
  /**
   * 진행 중 query/execute promise 집합. tx 종료 시 비어있지 않으면 await 누락으로 간주.
   * 카운터가 아닌 Set 으로 보관하여, 안전망 발동 시 unhandled rejection 방지를 위해
   * 각 promise 에 noop catch 를 부착할 수 있게 한다.
   */
  inflight: Set<Promise<unknown>>
  /** commit/rollback 진행 중 플래그. 이 시점 이후 신규 호출은 차단. */
  closing: boolean
  /**
   * 중첩 tx() 또는 교차 DB 호출이 감지되었을 때 부모 state 에 세팅되는 플래그.
   * 호출자가 자식 throw 를 try/catch 로 삼키더라도 commit 대신 rollback 으로 분기시키기 위함.
   */
  aborted: boolean
}

/** 단일 활성 tx 상태. tx 는 단일 DB 단위이므로 Map 이 아닌 단일 값. */
const txStore = new AsyncLocalStorage<TxState>()

/** 클라이언트 캐시. 모듈 스코프에 보관하여 HMR 시 재생성되도록 한다. */
const clientCache = new Map<string, IDbClient>()

/**
 * lifecycle 에서 이미 로깅한 DbError 추적용.
 * Error 인스턴스에 직접 속성을 박아넣지 않기 위해 WeakSet 으로 분리.
 * GC 시 자동 해제되므로 누수 우려 없음.
 */
const loggedErrors = new WeakSet<DbError>()

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
  const startedAt = new Date(start).toISOString()

  // 요청 컨텍스트(ALS) — actionAgent 에서 주입된 세션/액션/페이지 정보.
  // 스코프 바깥에서 호출되는 경우(예: warmup) 빈 객체로 안전하게 동작.
  const reqCtx = getRequestContext()

  // 3-tier traceId 모델 (OpenTelemetry 의 trace_id/parent_span_id/span_id 와 유사):
  //   - traceId        : 본 호출 자체의 식별자 (query/execute/tx 각각 새로 발급)
  //   - parentTraceId  : 직속 부모 — tx 안에서 실행된 query/execute 의 경우에만 tx traceId.
  //                       tx-op 자체나 tx 밖 호출은 undefined.
  //   - actionTraceId  : 요청(액션) 루트 식별자. 액션 전체 이력을 한 방에 묶는 용도.
  const st = txStore.getStore()
  const txState = st && st.dbName === args.dbName ? st : undefined
  const parentTraceId = txState?.traceId
  const actionTraceId = reqCtx.traceId

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
    const end = Date.now()
    const endedAt = new Date(end).toISOString()
    const durationMs = end - start
    if (loggable) log.info('db.ok', {
      db: args.dbName,
      provider: args.provider,
      op: args.op,
      traceId,
      parentTraceId,
      actionTraceId,
      startedAt,
      endedAt,
      durationMs,
      sql: args.sql,
      binds: args.binds,
      rowCount: countRows ? countRows(result) : undefined,
      ...ctxFields,
    })
    return result
  } catch (err) {
    const end = Date.now()
    const endedAt = new Date(end).toISOString()
    const durationMs = end - start
    const alreadyLogged = err instanceof DbError && loggedErrors.has(err)
    console.log(`SERVER: factory.ts - alreadyLogged: ${alreadyLogged}`)

    if (err instanceof DbError) {
      if (!alreadyLogged && loggable) {
        log.error('db.err', {
          db: args.dbName,
          provider: args.provider,
          op: args.op,
          traceId,
          parentTraceId,
          actionTraceId,
          startedAt,
          endedAt,
          durationMs,
          sql: args.sql,
          binds: args.binds,
          category: err.category,
          code: err.code,
          devMessage: err.devMessage,
          cause: err.cause instanceof Error ? err.cause.message : String(err.cause ?? ''),
          ...ctxFields,
        })
        loggedErrors.add(err)
        console.log(`SERVER: factory.ts - loggedErrors.add(err): ${loggedErrors}`)
      } else if (args.op === 'transaction' && loggable) {
        // 하위 쿼리에서 이미 로깅되었더라도, 트랜잭션 단위 실패 집계를 위해 요약 1줄 추가.
        log.error('db.err', {
          db: args.dbName,
          provider: args.provider,
          op: 'transaction',
          traceId,
          parentTraceId,
          actionTraceId,
          startedAt,
          endedAt,
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
        actionTraceId,
        startedAt,
        endedAt,
        durationMs,
        sql: args.sql,
        binds: args.binds,
        category: 'unknown',
        cause: err instanceof Error ? err.message : String(err),
        ...ctxFields,
      })
      loggedErrors.add(wrapped)
      console.log(`SERVER: factory.ts - loggedErrors.add(wrapped): ${loggedErrors}`)
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
          const st = txStore.getStore()
          if (st) {
            if (st.dbName !== name) {
              st.aborted = true
              throw new DbError({
                category: 'transaction',
                devMessage: `tx(${st.dbName}) 스코프 안에서 다른 DB(${name}) 호출은 허용되지 않습니다. 두 작업을 하나의 DB 로 통합하거나, 교차 DB 작업은 tx 바깥으로 분리하세요.`,
              })
            }
            if (st.aborted) {
              throw new DbError({
                category: 'transaction',
                devMessage: 'tx 스코프가 abort 상태입니다 — 중첩 트랜잭션/교차 DB 호출 감지 이후 추가 호출은 허용되지 않습니다.',
              })
            }
            if (st.closing) {
              throw new DbError({
                category: 'transaction',
                devMessage: 'tx 스코프가 이미 종료(closing) 상태입니다 — commit/rollback 이후의 호출은 허용되지 않습니다.',
              })
            }
            const p = provider.query<T>(name, dsn, pool, sql, binds, {
              ...safeOpts,
              traceId,
              conn: st.conn,
            })
            st.inflight.add(p)
            try {
              return await p
            } finally {
              st.inflight.delete(p)
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
          const st = txStore.getStore()
          if (st) {
            if (st.dbName !== name) {
              st.aborted = true
              throw new DbError({
                category: 'transaction',
                devMessage: `tx(${st.dbName}) 스코프 안에서 다른 DB(${name}) 호출은 허용되지 않습니다. 두 작업을 하나의 DB 로 통합하거나, 교차 DB 작업은 tx 바깥으로 분리하세요.`,
              })
            }
            if (st.aborted) {
              throw new DbError({
                category: 'transaction',
                devMessage: 'tx 스코프가 abort 상태입니다 — 중첩 트랜잭션/교차 DB 호출 감지 이후 추가 호출은 허용되지 않습니다.',
              })
            }
            if (st.closing) {
              throw new DbError({
                category: 'transaction',
                devMessage: 'tx 스코프가 이미 종료(closing) 상태입니다 — commit/rollback 이후의 호출은 허용되지 않습니다.',
              })
            }
            const p = provider.execute<T>(name, dsn, pool, sql, binds, {
              ...safeOpts,
              traceId,
              conn: st.conn,
            })
            st.inflight.add(p)
            try {
              return await p
            } finally {
              st.inflight.delete(p)
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
          if (parent) {
            // 호출자가 자식 throw 를 try/catch 로 삼키거나 await 을 빠뜨려도
            // 부모가 commit 으로 빠지지 않도록 부모 state 에 abort 플래그를 세팅한다.
            // (closing 은 'commit/rollback 진행 중' 의미를 유지하기 위해 건드리지 않는다.)
            parent.aborted = true
            const sameDb = parent.dbName === name
            throw new DbError({
              category: 'transaction',
              devMessage: sameDb
                ? '동일 DB 의 중첩 트랜잭션은 지원하지 않습니다. 단일 tx 콜백 안에서 모든 query/execute 를 수행하세요.'
                : `tx(${parent.dbName}) 스코프 안에서 다른 DB(${name}) 의 tx 시작은 허용되지 않습니다. 다중 DB 트랜잭션은 지원하지 않습니다.`,
            })
          }

          const conn = await provider.acquireTxConnection(name, dsn, pool)
          const state: TxState = {
            dbName: name, conn, traceId: txTraceId,
            inflight: new Set(), closing: false, aborted: false,
          }

          // 안전망 발동 여부 — true 가 되면 conn 을 풀에 반납하지 않고 destroy.
          // 여기서 말하는 "안전망" 은:
          //   1) 중첩 tx / 교차 DB 호출로 state.aborted = true
          //   2) tx 종료 시점에 in-flight 쿼리가 남아있음 (await 누락)
          //   3) catch 진입 시점에 in-flight 가 살아있어 rollback 과 race 가 우려됨
          // 위 경우에 풀로 돌려보내면 진행 중이던 driver 호출이 다음 사용자 conn 에
          // 묻어서 실행되는 cross-request 누수가 발생할 수 있다.
          let dirty = false

          try {
            const result = await txStore.run(state, fn)
            if (state.aborted) {
              dirty = true
              throw new DbError({
                category: 'transaction',
                devMessage: 'tx 스코프 안에서 중첩 트랜잭션 또는 교차 DB 호출이 감지되어 abort 됩니다. 부모는 rollback 됩니다.',
              })
            }
            if (state.inflight.size > 0) {
              dirty = true
              throw new DbError({
                category: 'transaction',
                devMessage: 'tx 종료 시점에 in-flight 쿼리가 남아 있습니다 — await 누락(예: forEach(async)) 을 의심하세요.',
              })
            }
            state.closing = true
            await provider.commit(conn)
            return result
          } catch (err) {
            state.closing = true
            // catch 진입 시점에 in-flight 가 살아있다면 그 자체로 dirty.
            // (정상 비즈니스 throw 인 경우라도 in-flight 가 남아있으면 race 가 남으므로 destroy 분기로 보낸다.)
            if (state.aborted || state.inflight.size > 0) dirty = true

            if (!dirty) {
              // 일상적 비즈니스 실패 — conn 상태가 깨끗하므로 rollback 후 풀 반납이 안전.
              try {
                await provider.rollback(conn)
              } catch {
                /* rollback 실패는 원본 에러를 가리지 않도록 무시 */
              }
            }
            // dirty 분기에서는 rollback 을 시도하지 않는다.
            // in-flight 와 같은 conn 위에서 rollback 이 동시에 실행되면 driver 가 꼬일 수 있고,
            // 이어지는 destroy 가 트랜잭션을 폐기하므로 rollback 없이도 데이터 정합성은 보장된다.
            throw err
          } finally {
            // in-flight 가 남아있다면 unhandled rejection 으로 새지 않도록 noop catch 부착.
            // (참조만 부착할 뿐 await 하지는 않으므로 destroy 가 늦어지지 않는다.)
            for (const p of state.inflight) {
              p.catch(() => { /* swallow */ })
            }
            try {
              if (dirty) {
                await provider.destroy(conn)
              } else {
                await provider.release(conn)
              }
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
// HMR / 다중 import 환경에서 핸들러가 중복 등록되지 않도록 globalThis 플래그로 가드.
const HOOK_FLAG = '__myapp_db_exit_hook__'
const globalFlags = globalThis as unknown as Record<string, boolean | undefined>
if (!globalFlags[HOOK_FLAG]) {
  globalFlags[HOOK_FLAG] = true
  const close = () => { void closeAllProviders() }
  process.once('beforeExit', close)
  process.once('SIGINT', close)
  process.once('SIGTERM', close)
}
