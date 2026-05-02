/**
 * @module lib/db/types
 * @description
 * DB 레이어의 공개 타입 정의. provider(oracledb 등) 의존을 외부로 누수시키지 않기 위해
 * 모든 호출자(서버 액션·라우트 핸들러)는 오직 이 파일의 타입만 사용해야 한다.
 */

/** 지원하는 DB 프로바이더. 신규 프로바이더 추가 시 여기 union 확장. */
export type ProviderName = 'oracle' // | 'postgres' | 'mariadb'

/**
 * 바인드 파라미터.
 * - 객체 형태: 네임드 바인드 (`:name`)
 * - 배열 형태: 포지셔널 바인드
 * provider 어댑터 내부에서만 oracledb 등 네이티브 타입으로 변환된다.
 */
export type BindParams = Record<string, unknown> | unknown[]

/**
 * 쿼리별 공개 옵션. 호출자(서버 액션·라우트 핸들러)가 사용 가능한 필드는 이게 전부다.
 * traceId/parentTraceId/conn 같은 메타는 factory 가 자동 주입하므로 의도적으로 노출하지 않는다.
 */
export interface QueryOptions {
  /** 최대 반환 행 수. provider 가 지원하면 적용. */
  maxRows?: number
  /** 쿼리 타임아웃(ms). provider 가 지원하면 적용. */
  timeoutMs?: number
}

/**
 * factory ↔ provider 사이에서만 사용하는 내부 옵션.
 * 공개 `QueryOptions` 를 확장하여 trace / 트랜잭션 raw 커넥션 메타를 덧붙인다.
 * provider 구현체는 이 타입을 받지만, IDbClient 를 통해 호출하는 외부 코드는 도달할 수 없다.
 */
export interface InternalQueryOptions extends QueryOptions {
  /**
   * 로그 상관관계용 trace ID. factory 의 `withLifecycle` 에서 자동 발급.
   */
  traceId?: string
  /**
   * 트랜잭션 내부 호출의 경우, 바깥 transaction lifecycle 의 traceId.
   * 내부 개별 query/execute 로그를 하나의 트랜잭션으로 묶기 위함.
   */
  parentTraceId?: string
  /**
   * factory 가 ALS 트랜잭션 컨텍스트에서 provider 로 전달하는 raw 커넥션.
   */
  conn?: unknown
}

export type QueryResult<T = Record<string, unknown>> = {
  columns: { name: string; type: 'string' | 'number' | 'date' }[]
  rows: T[]
}

/** INSERT/UPDATE/DELETE 결과. */
export type ExecuteResult<T = Record<string, unknown>> = {
  rows: T[]
  rowsAffected: number
}

/**
 * 호출자가 사용하는 표준 DB 클라이언트 인터페이스.
 * `getDb(name)` 가 반환하는 객체의 형태.
 *
 * 트랜잭션은 `tx(async () => { ... })` 로 시작/종료를 명시한다. 콜백은 인자를 받지 않으며,
 * 내부의 모든 `db.query/execute` 호출은 ALS 컨텍스트를 통해 자동으로 동일 커넥션을 공유한다.
 * 콜백이 정상 종료되면 commit, throw 하면 rollback 후 에러 재전파.
 */
export interface IDbClient {
  /** SELECT 류 — 행 배열 반환. */
  query<T = Record<string, unknown>>(
    sql: string,
    binds?: BindParams,
    opts?: QueryOptions,
  ): Promise<QueryResult<T>>

  /** INSERT/UPDATE/DELETE — rowsAffected 포함. */
  execute<T = Record<string, unknown>>(
    sql: string,
    binds?: BindParams,
    opts?: QueryOptions,
  ): Promise<ExecuteResult<T>>

  /**
   * 트랜잭션 스코프. 콜백 안에서 동일 `db` 의 query/execute 를 호출하면
   * ALS 컨텍스트를 통해 자동으로 같은 커넥션 위에서 수행된다.
   * 동일 DB 의 중첩 호출은 런타임에 차단된다.
   */
  tx<R>(fn: () => Promise<R>): Promise<R>
}

/** 풀 옵션. 미지정 항목은 provider 기본값 사용. */
export interface PoolOptions {
  /** 최소 커넥션 수 (default: 1) */
  min?: number
  /** 최대 커넥션 수 (default: 10) */
  max?: number
  /** 한 번에 늘릴 커넥션 수 (default: 1) */
  increment?: number
  /** idle 커넥션 종료 시간(초) (default: 60) */
  timeoutSec?: number
}

/** 평문 connectString 을 파싱한 결과 — provider 가 사용(내부 전용). */
export interface ResolvedDsn {
  user: string
  password: string
  /** `host:port/service` 형태 (oracledb 의 connectString 필드) */
  connectString: string
}

/**
 * 프로바이더 어댑터 인터페이스.
 * factory ↔ provider 의 유일한 경계. 신규 DB 종류 추가 시 이 인터페이스만 구현하면 된다.
 */
export interface IDbProvider {
  query<T>(
    dbName: string,
    dsn: ResolvedDsn,
    pool: PoolOptions | undefined,
    sql: string,
    binds: BindParams,
    opts: InternalQueryOptions,
  ): Promise<QueryResult<T>>

  execute<T>(
    dbName: string,
    dsn: ResolvedDsn,
    pool: PoolOptions | undefined,
    sql: string,
    binds: BindParams,
    opts: InternalQueryOptions,
  ): Promise<ExecuteResult<T>>

  /**
   * 트랜잭션용 raw 커넥션을 풀에서 빌린다. autoCommit 비활성 모드로 사용된다.
   * factory 가 ALS 컨텍스트를 만들 때 1회 호출하며, commit/rollback/release 는 별도 훅으로 처리한다.
   */
  acquireTxConnection(
    dbName: string,
    dsn: ResolvedDsn,
    pool: PoolOptions | undefined,
  ): Promise<unknown>

  /** 트랜잭션 커밋. */
  commit(conn: unknown): Promise<void>

  /** 트랜잭션 롤백. 실패해도 원본 에러를 가리지 않도록 호출자가 swallow 한다. */
  rollback(conn: unknown): Promise<void>

  /** 커넥션 풀 반납. 실패는 무시. */
  release(conn: unknown): Promise<void>

  /**
   * 커넥션을 풀로 반납하지 않고 폐기한다.
   * tx 안전망(in-flight 누락 / aborted)이 발동된 경우 사용한다 — 진행 중이던 driver
   * 호출이 다음 사용자의 conn 을 오염시키는 race 를 구조적으로 차단하기 위함.
   * 풀은 새 conn 을 만들어 자리를 채운다. 실패는 호출부가 무시한다.
   */
  destroy(conn: unknown): Promise<void>

  /**
   * 풀을 선제적으로 생성·초기화한다. 이미 생성된 풀이 있으면 no-op.
   * 서버 부팅 시점의 워밍업 용도로 호출된다.
   */
  warmup(
    dbName: string,
    dsn: ResolvedDsn,
    pool: PoolOptions | undefined,
  ): Promise<void>

  closePool(dbName: string): Promise<void>
  closeAll(): Promise<void>
}
