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

/** 쿼리별 옵션. 모두 선택. */
export interface QueryOptions {
  /** 최대 반환 행 수. provider 가 지원하면 적용. */
  maxRows?: number
  /** 쿼리 타임아웃(ms). provider 가 지원하면 적용. */
  timeoutMs?: number
  /**
   * 로그 상관관계용 trace ID.
   * 미지정 시 factory 에서 자동 생성하여 모든 로그 라인에 기록.
   */
  traceId?: string
  /**
   * 트랜잭션 내부 호출의 경우, 바깥 transaction lifecycle 의 traceId.
   * 내부 개별 query/execute 로그를 하나의 트랜잭션으로 묶기 위함.
   */
  parentTraceId?: string
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
   * 트랜잭션. 콜백 내부의 모든 query/execute 는 동일 커넥션 위에서 수행되며,
   * 콜백이 정상 종료되면 commit, throw 하면 rollback 후 에러 재전파.
   */
  transaction<R>(fn: (tx: IDbClient) => Promise<R>): Promise<R>
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

/**
 * `lib/db/config/databases.ts` 의 한 항목 형태.
 * C# 레거시의 DB.config 한 row 에 대응.
 */
export interface DbConfigEntry {
  /** 사용할 프로바이더. */
  providerName: ProviderName
  /** connectString 필드가 암호화되어 있는지 여부. */
  encrypt: boolean
  /**
   * DB 접속 문자열.
   * - 평문: `user/password@host:port/service`
   * - 암호문: `enc:v1:<iv>:<tag>:<cipher>` (scripts/db-encrypt.mjs 로 생성)
   */
  connectString: string
  /** 풀 옵션. 미지정 시 provider 기본값 적용. */
  pool?: PoolOptions
}

/** 평문 connectString 을 파싱한 결과 — provider 가 사용. */
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
    opts: QueryOptions,
  ): Promise<QueryResult<T>>

  execute<T>(
    dbName: string,
    dsn: ResolvedDsn,
    pool: PoolOptions | undefined,
    sql: string,
    binds: BindParams,
    opts: QueryOptions,
  ): Promise<ExecuteResult<T>>

  withTransaction<R>(
    dbName: string,
    dsn: ResolvedDsn,
    pool: PoolOptions | undefined,
    fn: (tx: IDbClient) => Promise<R>,
  ): Promise<R>

  closePool(dbName: string): Promise<void>
  closeAll(): Promise<void>
}
