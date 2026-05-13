/**
 * @module lib/db/factory
 * @description
 * `getDb(name)` — 환경변수 전용 DB 팩토리. DB 레이어의 단일 진입점.
 *
 * 접속 정보는 오직 `.env.local` 의 `DB_CONNECTION__<NAME>` 환경변수에서 해석된다.
 * query/execute/transaction 안에서 시작·종료 시간 측정과 로깅을 직접 수행하며,
 * 호출 컨텍스트의 사용자 정보는 `getRequestCtx()` 로 best-effort 조회한다 — 세션이
 * 없어도 throw 하지 않으므로 next-auth 의 authorize 콜백 같은 "로그인 도중" 경로도
 * 그대로 이 팩토리를 쓸 수 있다.
 *
 * ## 트랜잭션 모델 (ALS 기반, 단일 DB 전용)
 *
 * `db.transaction(async () => { ... })` 호출은 모듈 스코프 `AsyncLocalStorage` (`txStore`)
 * 에 트랜잭션 상태를 저장한다. 콜백 안에서 같은 `db` 의 `query/execute` 를 호출하면
 * ALS 컨텍스트에서 raw 커넥션을 꺼내 provider 로 전달하므로, 호출자는 별도의 tx 인자를
 * 받을 필요가 없다.
 *
 * transaction 은 **단일 DB 단위** 로만 동작한다. 다음은 런타임에 차단된다:
 *  - 동일 DB 의 중첩 transaction
 *  - 다른 DB 의 중첩 transaction (다중 DB 트랜잭션 미지원 — XA 아님)
 *  - transaction 스코프 안에서 다른 DB 의 query/execute 호출
 *
 * 그 외 await 누락 등 개발자 실수는 ESLint 와 코드 리뷰로 차단한다.
 *
 * 호출 예시:
 * ```ts
 * import { getDb } from '@/lib/db'
 * const db = getDb('MAIN')
 * await db.transaction(async () => {
 *   await db.execute('UPDATE ...')
 *   await db.execute('UPDATE ...')
 * })
 * ```
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import { inspect } from 'node:util'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { insertLogQuery, loggingScope } from './logger'
import { closeAllProviders, getProvider } from './providers'
import { resolveFromEnv } from './resolvers/env'
import type {
  BindParams,
  IDbClient,
} from './types'

dayjs.extend(utc)

// raw 에러 전체(메시지/스택/driver code/cause 체인) 를 한 줄 텍스트로 직렬화.
// String(err) → "Error: 메시지" 만, JSON.stringify(err) → 빈 객체 {} 라서 inspect 사용.

interface TxState {
  /** 이 transaction 스코프가 속한 DB 이름. 다른 DB 호출 차단을 위해 사용. */
  dbName: string
  /** provider 별 raw 커넥션 (oracledb.Connection 등). provider 외부에서는 사용 금지. */
  conn: unknown
}

const txStore = new AsyncLocalStorage<TxState>()
const clientCache = new Map<string, IDbClient>()

export function getDb(name: string = 'MAIN'): IDbClient {
  const cached = clientCache.get(name)
  if (cached) return cached

  const envResult = resolveFromEnv(name)
  if (!envResult) {
    throw new Error(`환경변수 DB_CONNECTION__${name} 이 설정되지 않았습니다`)
  }

  const { providerName, dsn, pool } = envResult
  const provider = getProvider(providerName)

  const client: IDbClient = {
    async query<T>(sql: string, binds: BindParams = {}) {
      const startedAt = dayjs().utcOffset(9 * 60).format('YYYY-MM-DDTHH:mm:ss.SSSZ')
      try {
        const st = txStore.getStore()
        if (st && st.dbName !== name) {
          throw new Error(`tx(${st.dbName}) 스코프 안에서 다른 DB(${name}) 호출은 허용되지 않습니다.`)
        }
        const result = await provider.query<T>(name, dsn, pool, sql, binds, st ? { conn: st.conn } : {})
        if (!loggingScope.getStore()) {
          void insertLogQuery({ db: name, provider: providerName, op: 'query', sql, startedAt, endedAt: dayjs().utcOffset(9 * 60).format('YYYY-MM-DDTHH:mm:ss.SSSZ'), rowCount: result.rows.length, })
        }
        return result
      } catch (err) {
        if (!loggingScope.getStore()) {
          void insertLogQuery({ db: name, provider: providerName, op: 'query', sql, startedAt, endedAt: dayjs().utcOffset(9 * 60).format('YYYY-MM-DDTHH:mm:ss.SSSZ'), errorDesc: inspect(err, { depth: null, breakLength: Infinity, maxStringLength: Infinity }), })
        }
        throw err
      }
    },

    async execute<T>(sql: string, binds: BindParams = {}) {
      const startedAt = dayjs().utcOffset(9 * 60).format('YYYY-MM-DDTHH:mm:ss.SSSZ')
      try {
        const st = txStore.getStore()
        if (st && st.dbName !== name) {
          throw new Error(`tx(${st.dbName}) 스코프 안에서 다른 DB(${name}) 호출은 허용되지 않습니다.`)
        }
        const result = await provider.execute<T>(name, dsn, pool, sql, binds, st ? { conn: st.conn } : {})
        if (!loggingScope.getStore()) {
          void insertLogQuery({ db: name, provider: providerName, op: 'execute', sql, startedAt, endedAt: dayjs().utcOffset(9 * 60).format('YYYY-MM-DDTHH:mm:ss.SSSZ'), rowCount: result.rowsAffected, })
        }
        return result
      } catch (err) {
        if (!loggingScope.getStore()) {
          void insertLogQuery({ db: name, provider: providerName, op: 'execute', sql, startedAt, endedAt: dayjs().utcOffset(9 * 60).format('YYYY-MM-DDTHH:mm:ss.SSSZ'), errorDesc: inspect(err, { depth: null, breakLength: Infinity, maxStringLength: Infinity }), })
        }
        throw err
      }
    },

    async transaction<R>(fn: () => Promise<R>): Promise<R> {
      const parent = txStore.getStore()
      if (parent) {
        const sameDb = parent.dbName === name
        throw new Error(
          sameDb
            ? '동일 DB 의 중첩 트랜잭션은 지원하지 않습니다. 단일 transaction 콜백 안에서 모든 query/execute 를 수행하세요.'
            : `tx(${parent.dbName}) 스코프 안에서 다른 DB(${name}) 의 transaction 시작은 허용되지 않습니다. 다중 DB 트랜잭션은 지원하지 않습니다.`,
        )
      }

      const conn = await provider.acquireTxConnection(name, dsn, pool)
      const state: TxState = { dbName: name, conn }

      try {
        const result = await txStore.run(state, fn)
        await provider.commit(conn)
        return result
      } catch (err) {
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
    throw new Error(`환경변수 DB_CONNECTION__${name} 이 설정되지 않았습니다`)
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
