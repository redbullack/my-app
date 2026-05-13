/**
 * @module lib/db/providers/mssql
 * @description
 * Microsoft SQL Server 프로바이더 어댑터 (`mssql` 패키지 — 내부적으로 tedious 래핑).
 * oracle.ts / postgres.ts 와 동일하게 `IDbProvider` 를 구현하며, factory 의 ALS
 * 트랜잭션 모델과 1:1 호환된다.
 *
 * ## oracledb/pg 와 다른 점 (어댑팅 포인트)
 *
 *  1) **풀이 conn 을 직접 노출하지 않는다**
 *     mssql 의 `ConnectionPool` 은 `pool.request()` 단위로 동작한다. oracledb 처럼
 *     `pool.getConnection()` → `conn.execute()` 형태가 아니라, 모든 쿼리는 `Request`
 *     객체를 통해 발급되고 풀이 내부적으로 conn 을 매칭한다.
 *
 *  2) **트랜잭션 conn = `sql.Transaction` 객체**
 *     `new sql.Transaction(pool)` → `tx.begin()` 시점에 mssql 이 내부적으로 풀에서 conn
 *     1개를 잡아 transaction 에 매어둔다. 같은 tx 위에서 `new sql.Request(tx).query(...)`
 *     를 호출하면 mssql 이 그 conn 으로 라우팅한다. 즉 factory ALS 에 저장되는
 *     `state.conn` 은 raw connection 이 아니라 **Transaction 객체** 다.
 *     `IDbProvider` 의 시그니처가 `conn: unknown` 이라 타입 호환성에는 문제 없다.
 *
 *  3) **bind: `@name` native, SQL 변환 불필요**
 *     mssql 은 `request.input(name, value)` 로 등록하고 SQL 에 `@name` 으로 참조하는
 *     방식을 native 지원한다. 객체 binds 는 그대로 input 등록만 하면 끝이라
 *     postgres 처럼 SQL 토크나이징이 필요 없다. 배열 binds 는 `_p0, _p1, ...` 이름으로
 *     자동 등록되며, 호출자는 SQL 에 `@_p0` 형태로 작성한다.
 *
 *  4) **encrypt 기본값**
 *     mssql v10+ 는 기본 `encrypt:true` 라서 self-signed 인증서를 쓰는 사내망 DB 에서는
 *     `trustServerCertificate:true` 가 없으면 접속이 실패한다. 본 어댑터는
 *     `encrypt: true, trustServerCertificate: true` 를 기본으로 둔다 — 사내 운영 환경의
 *     일반적인 형태에 맞춘 절충값이며, 공인 인증서를 쓰는 환경에서는 양쪽 모두 true 여도
 *     문제없다.
 *
 * 풀 캐시는 HMR/다중 import 환경에서의 누수 방지를 위해 globalThis 에 보관한다.
 */

import * as sql from 'mssql'
import type {
  BindParams,
  ExecuteResult,
  IDbProvider,
  PoolOptions,
  QueryOptions,
  QueryResult,
  ResolvedDsn,
} from '../types'
// import { getDbLogger } from '../logger'

/* ─── 풀 캐시 ──────────────────────────────────────────────────────── */

type PoolStore = Map<string, Promise<sql.ConnectionPool>>
const GLOBAL_KEY = '__myapp_mssql_pools__'
function getPoolStore(): PoolStore {
  const g = globalThis as unknown as Record<string, PoolStore | undefined>
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = new Map()
  return g[GLOBAL_KEY]!
}

/* ─── DSN 파싱 ─────────────────────────────────────────────────────── */

/**
 * env resolver 가 만들어주는 `connectString` (`host:port/database` 형태) 을
 * mssql 의 server/port/database 로 분해한다. port 가 생략되면 기본 1433.
 */
function parseMssqlLocation(connectString: string): {
  server: string
  port: number
  database: string
} {
  const slash = connectString.lastIndexOf('/')
  if (slash < 0) {
    throw new Error(`Mssql connectString 형식 오류 — '/database' 가 없습니다: ${connectString}`)
  }
  const hostPort = connectString.slice(0, slash)
  const database = connectString.slice(slash + 1)
  if (!database) {
    throw new Error(`Mssql connectString 의 database 가 비어있습니다: ${connectString}`)
  }

  const colon = hostPort.lastIndexOf(':')
  let server: string
  let port: number
  if (colon < 0) {
    server = hostPort
    port = 1433
  } else {
    server = hostPort.slice(0, colon)
    const portStr = hostPort.slice(colon + 1)
    const parsed = Number.parseInt(portStr, 10)
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) {
      throw new Error(`Mssql connectString 의 port 가 잘못되었습니다: ${portStr}`)
    }
    port = parsed
  }
  if (!server) {
    throw new Error(`Mssql connectString 의 server 가 비어있습니다: ${connectString}`)
  }
  return { server, port, database }
}

/* ─── bind 적용 (`@name`) ──────────────────────────────────────────── */

/**
 * Request 에 binds 를 등록한다.
 *
 *  - 객체 binds: 각 key → `request.input(key, value)`.
 *    SQL 에는 호출자가 `@key` 로 참조해두면 된다.
 *  - 배열 binds: index → `_p0, _p1, ...` 이름으로 등록.
 *    SQL 에는 호출자가 `@_p0, @_p1, ...` 로 참조해야 한다.
 *
 * 값의 타입은 mssql 의 type 추론에 위임한다 (`Date` → datetime, number → int/float,
 * string → nvarchar, Buffer → varbinary 등). 명시적 타입 지정이 필요한 케이스
 * (예: TEXT 컬럼에 큰 nvarchar(max) 값) 는 본 학습 프레임워크 범위 밖이며,
 * 필요 시 호출자가 사전 변환하는 방향으로 통일한다.
 */
function applyBinds(request: sql.Request, binds: BindParams): void {
  if (Array.isArray(binds)) {
    for (let i = 0; i < binds.length; i++) {
      request.input(`_p${i}`, binds[i])
    }
    return
  }
  for (const [name, value] of Object.entries(binds)) {
    request.input(name, value)
  }
}

/* ─── 타입 매핑 (mssql 타입 → 우리 표준 type) ──────────────────────── */

/**
 * `recordset.columns[name].type` 은 mssql 의 type factory 자체(`sql.Int`, `sql.NVarChar` 등) 가
 * 들어온다. 참조 비교로 number/date 류를 골라낸다.
 *
 * 미열거 타입(Bit/UniqueIdentifier/Char/Binary/Xml/Json 등) 은 모두 'string' 으로 묶는다.
 * factory 호환 type 셋이 string/number/date 3종이므로 그 외는 string 으로 표현한다.
 */
const NUMBER_TYPES: ReadonlySet<unknown> = new Set([
  sql.TinyInt,
  sql.SmallInt,
  sql.Int,
  sql.BigInt,
  sql.Decimal,
  sql.Numeric,
  sql.Float,
  sql.Real,
  sql.Money,
  sql.SmallMoney,
])

const DATE_TYPES: ReadonlySet<unknown> = new Set([
  sql.Date,
  sql.Time,
  sql.DateTime,
  sql.DateTime2,
  sql.SmallDateTime,
  sql.DateTimeOffset,
])

function mapMssqlType(t: unknown): 'string' | 'number' | 'date' {
  if (NUMBER_TYPES.has(t)) return 'number'
  if (DATE_TYPES.has(t)) return 'date'
  return 'string'
}

function toColumns(
  columns: sql.IColumnMetadata | undefined,
): { name: string; type: 'string' | 'number' | 'date' }[] {
  if (!columns) return []
  // recordset.columns 는 컬럼명을 키로 가지는 객체 + 각 entry 에 .index 가 채워져 있다.
  // 결과 순서를 안정적으로 유지하기 위해 index 로 정렬한다.
  const entries = Object.values(columns) as Array<sql.IColumnMetadata[string]>
  entries.sort((a, b) => a.index - b.index)
  return entries.map((c) => ({ name: c.name, type: mapMssqlType(c.type) }))
}

/* ─── 풀 생성 ─────────────────────────────────────────────────────── */

async function getPool(
  dbName: string,
  dsn: ResolvedDsn,
  pool: PoolOptions | undefined,
): Promise<sql.ConnectionPool> {
  const store = getPoolStore()
  const existing = store.get(dbName)
  if (existing) return existing

  // const log = getDbLogger()
  const { server, port, database } = parseMssqlLocation(dsn.connectString)

  // mssql 의 ConnectionPool 은 생성 시점에는 idle, `connect()` 호출 시 실제 풀이 채워진다.
  // 우리는 Promise<ConnectionPool> 을 캐시하고 connect 가 끝난 객체를 resolve.
  const created = (async () => {
    const config: sql.config = {
      server,
      port,
      database,
      user: dsn.user,
      password: dsn.password,
      pool: {
        min: pool?.min ?? 1,
        max: pool?.max ?? 10,
        idleTimeoutMillis: (pool?.timeoutSec ?? 60) * 1000,
      },
      options: {
        // 사내망 self-signed 인증서를 받아들이는 절충값. 운영 협의에 따라 false 로 좁힐 수 있다.
        encrypt: true,
        trustServerCertificate: true,
        // application_name 에 해당. SQL Server 의 sys.dm_exec_sessions 에서 식별용.
        appName: `myapp:${dbName}`,
      },
      // 풀이 다 차서 새 conn 도 못 만들 때 대기 상한 (ms). 기본은 15s.
      // pg 어댑터와 동일하게 30s 로 맞춘다.
      connectionTimeout: 30_000,
      // 풀에서 conn 을 acquire 할 때 대기 상한.
      requestTimeout: 30_000,
    }

    try {
      const p = new sql.ConnectionPool(config)

      // 풀 단위 'error' 이벤트 — idle conn 이 서버 측에서 끊겼을 때 발생.
      // 처리하지 않으면 Node 가 프로세스를 종료시킬 수 있어 listener 부착 필수.
      p.on('error', (err) => {
        console.error('pool.idle_error', {
          db: dbName,
          provider: 'mssql',
          cause: err instanceof Error ? err.message : String(err),
        })
      })

      await p.connect()

      console.info('pool.created', {
        db: dbName,
        provider: 'mssql',
        min: pool?.min ?? 1,
        max: pool?.max ?? 10,
      })

      return p
    } catch (err) {
      // 실패 시 캐시에서 제거 → 다음 호출에 재시도 가능.
      store.delete(dbName)
      throw err
    }
  })()

  store.set(dbName, created)
  return created
}

/* ─── 공통 실행 헬퍼 ─────────────────────────────────────────────── */

/**
 * `new sql.Request(parent, overrides)` 의 2번째 인자(`requestTimeout`) 는 mssql 런타임은
 * 지원하지만 `@types/mssql` 의 d.ts 에는 노출되어 있지 않다. 또한 d.ts 의 생성자가
 * `ConnectionPool` / `Transaction` / `PreparedStatement` 를 각각 별도 overload 로만 받고
 * union 을 받지 않아 TS 가 선택을 못 한다. 두 문제를 한 곳에서 해결하기 위해 좁은 형태의
 * 생성자 시그니처를 직접 선언해 사용한다 (런타임 동작은 mssql 의 base/request.js 기준).
 */
type RequestCtor = new (
  parent: sql.ConnectionPool | sql.Transaction,
  overrides?: { requestTimeout?: number },
) => sql.Request
const RequestWithOverrides = sql.Request as unknown as RequestCtor

/**
 * Request 한 건 실행. tx 컨텍스트에서는 `parent` 로 `sql.Transaction` 을, 풀 직접 사용
 * 시에는 `sql.ConnectionPool` 을 전달한다.
 */
async function runRequest(
  parent: sql.ConnectionPool | sql.Transaction,
  sqlText: string,
  binds: BindParams,
): Promise<sql.IResult<Record<string, unknown>>> {
  const request = new RequestWithOverrides(parent)
  applyBinds(request, binds)
  return request.query<Record<string, unknown>>(sqlText)
}

function totalRowsAffected(result: sql.IResult<unknown>): number {
  // rowsAffected 는 batch 내 각 statement 별 합계 배열.
  return Array.isArray(result.rowsAffected)
    ? result.rowsAffected.reduce((a, b) => a + (b ?? 0), 0)
    : (result.rowsAffected ?? 0)
}

/* ─── IDbProvider 구현체 ─────────────────────────────────────────── */

async function mssqlQuery<T>(
  dbName: string,
  dsn: ResolvedDsn,
  pool: PoolOptions | undefined,
  sqlText: string,
  binds: BindParams,
  opts: QueryOptions,
): Promise<QueryResult<T>> {
  // 트랜잭션 컨텍스트에서 전달된 Transaction 위에서 실행.
  if (opts.conn) {
    const tx = opts.conn as sql.Transaction
    const result = await runRequest(tx, sqlText, binds)
    const rows = (result.recordset ?? []) as unknown as T[]
    return { columns: toColumns(result.recordset?.columns), rows }
  }

  const p = await getPool(dbName, dsn, pool)
  const result = await runRequest(p, sqlText, binds)
  const rows = (result.recordset ?? []) as unknown as T[]
  return { columns: toColumns(result.recordset?.columns), rows }
}

async function mssqlExecute<T>(
  dbName: string,
  dsn: ResolvedDsn,
  pool: PoolOptions | undefined,
  sqlText: string,
  binds: BindParams,
  opts: QueryOptions,
): Promise<ExecuteResult<T>> {
  if (opts.conn) {
    const tx = opts.conn as sql.Transaction
    const result = await runRequest(tx, sqlText, binds)
    const rows = (result.recordset ?? []) as unknown as T[]
    return { rows, rowsAffected: totalRowsAffected(result) }
  }

  const p = await getPool(dbName, dsn, pool)
  const result = await runRequest(p, sqlText, binds)
  const rows = (result.recordset ?? []) as unknown as T[]
  return { rows, rowsAffected: totalRowsAffected(result) }
}

/**
 * 트랜잭션을 시작하고 `Transaction` 객체를 conn 으로 반환한다.
 *
 * `begin()` 자체가 실패하면 mssql 이 내부적으로 잡아두던 conn 도 풀로 반납된다.
 * (Transaction 객체는 GC 대상이며 추가 cleanup 불필요.)
 */
async function mssqlAcquireTxConnection(
  dbName: string,
  dsn: ResolvedDsn,
  pool: PoolOptions | undefined,
): Promise<unknown> {
  const p = await getPool(dbName, dsn, pool)
  const tx = new sql.Transaction(p)
  await tx.begin()
  return tx
}

async function mssqlCommit(conn: unknown): Promise<void> {
  await (conn as sql.Transaction).commit()
}

async function mssqlRollback(conn: unknown): Promise<void> {
  await (conn as sql.Transaction).rollback()
}

/**
 * 정상 종료 경로의 release. commit/rollback 시점에 mssql 이 이미 내부 conn 을
 * 풀로 반납하므로 별도 작업이 없다. 인터페이스 일치를 위해 no-op 구현으로 둔다.
 */
async function mssqlRelease(_conn: unknown): Promise<void> {
  /* mssql 은 commit/rollback 시점에 자동 release. 본 훅에서는 별도 작업 없음. */
}

/**
 * 풀을 선제 생성. `ConnectionPool.connect()` 까지 완료시켜 첫 요청 지연을 제거.
 * mssql 풀은 connect 시점에 `min` 만큼 conn 을 즉시 채워두므로 별도 warm-up 루프는 불필요.
 */
async function mssqlWarmup(
  dbName: string,
  dsn: ResolvedDsn,
  pool: PoolOptions | undefined,
): Promise<void> {
  await getPool(dbName, dsn, pool)
}

async function mssqlClosePool(dbName: string): Promise<void> {
  const store = getPoolStore()
  const p = store.get(dbName)
  if (!p) return
  store.delete(dbName)
  try {
    const pool = await p
    await pool.close()
  } catch {
    /* noop */
  }
}

async function mssqlCloseAll(): Promise<void> {
  const store = getPoolStore()
  const entries = Array.from(store.entries())
  store.clear()
  await Promise.all(
    entries.map(async ([, pp]) => {
      try {
        const pool = await pp
        await pool.close()
      } catch {
        /* noop */
      }
    }),
  )
}

export const mssqlProvider: IDbProvider = {
  query: mssqlQuery,
  execute: mssqlExecute,
  acquireTxConnection: mssqlAcquireTxConnection,
  commit: mssqlCommit,
  rollback: mssqlRollback,
  release: mssqlRelease,
  warmup: mssqlWarmup,
  closePool: mssqlClosePool,
  closeAll: mssqlCloseAll,
}
