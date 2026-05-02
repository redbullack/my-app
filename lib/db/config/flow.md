# 트랜잭션 안전망 참고 자료

## TxState 속성 역할 정리

`lib/db/factory.ts` 의 `TxState` 인터페이스가 보유한 각 속성의 책임:

| 속성 | 역할 | 사용 지점 |
|---|---|---|
| `dbName` | 이 tx 가 속한 DB 식별자. 다른 DB 호출 차단(`st.dbName !== name`) 의 비교 키 | query/execute 진입부 |
| `conn` | provider 가 풀에서 빌려준 raw 커넥션. ALS 를 통해 query/execute 가 같은 conn 위에서 실행되도록 전달되고, commit/rollback/release/destroy 의 인자로 사용 | query/execute, finalize 단계 |
| `traceId` | tx 단위 trace ID. 하위 query/execute 로그의 `parentTraceId` 로 연결되어 한 트랜잭션의 호출들을 묶음 | `withLifecycle` |
| `inflight` | 진행 중 query/execute promise 집합. tx 종료 시점에 비어있지 않으면 await 누락 → dirty. unhandled rejection 방지를 위해 noop catch 부착 대상도 됨 | query/execute add/delete, tx 종료 시 검사 |
| `closing` | commit/rollback 이 시작된 이후를 표시. 이 시점 이후 ALS 캡처로 늦게 도달한 호출을 차단 (예: setTimeout 으로 commit 이후에 도달하는 query) | query/execute 의 가드 |
| `aborted` | 중첩 tx / 교차 DB 호출이 감지되었음. 호출자가 throw 를 try/catch 로 삼키더라도 commit 분기를 rollback 분기로 강제 전환 | 부모 state 에 set, tx 종료 시 검사 |

핵심 분류:
- **conn / traceId** — 정체성 · 리소스
- **inflight** — 생명주기 추적 (await 누락 검출 + unhandled rejection 차단)
- **closing / aborted** — 게이트 플래그. 둘 다 "신규 호출 차단" 효과를 가지지만 의미 축이 다름:
  - `closing` = "이미 닫고 있음" (물리 단계)
  - `aborted` = "결과는 rollback 으로" (논리 분기)

---

## 드라이버별 conn 폐기 가능성

tx 안전망 발동 시 사용하는 `provider.destroy(conn)` (풀에 반납하지 않고 폐기) 의 드라이버별 구현 난이도. cancel(진행 중 statement 인터럽트) 은 현재 구현 범위 밖이지만 참고용으로 함께 기재.

| Driver | 풀 미반납 폐기 | Cancel (진행 중 인터럽트) | 까다로움 |
|---|---|---|---|
| **oracledb** | `connection.close({ drop: true })` | `connection.break()` | ★ 쉬움 — 공식 API 둘 다 깔끔 |
| **pg** (postgres) | `pool.release(client, true)` 또는 `client.release(err)` 에 truthy 전달 시 풀에서 제거 | 별도 cancel connection 필요 (pg_cancel_backend) | ★★ 보통 — 풀 API 가 둘째 인자로 처리 |
| **mysql2** | `connection.destroy()` (즉시 소켓 끊기) | `KILL QUERY <id>` 별도 conn 으로 | ★ 쉬움 — destroy 가 명시적 |
| **mariadb** | `connection.destroy()` | mysql2 와 동일 | ★ 쉬움 |
| **mssql** (tedious) | 표준 `pool.release` 에 destroy 플래그 없음. `connection.close()` 후 풀에서 수동 제거 | `request.cancel()` (per-statement) | ★★★ 까다로움 — 풀 wrapper 의존, 드라이버마다 동작 다름 |
| **DB2** (ibm_db) | `Pool.close(conn, cb)` 가 conn 닫고 풀에서 제거. 단 pool 구현이 다양 | CLI 레벨 `SQLCancel` 존재하나 node binding 노출 제한적 | ★★★ 까다로움 — 풀 구현 통일 안 됨, callback 기반 API |
| **node-odbc** | `connection.close()` 만 제공. 풀은 보통 사용자 측에서 구현 (또는 `odbc.pool()` 의 `close()`). 풀 wrapper 가 직접 제어 | `SQLCancel` 은 ODBC API 에 있으나 node-odbc 가 거의 노출 안 함 | ★★★★ 매우 까다로움 — 풀 동작이 라이브러리/버전마다 갈림 |

핵심 인사이트:
- **oracle / mysql2 / mariadb** — 공식 API 한 줄로 끝
- **pg** — `release(client, true)` 패턴이 잘 정착되어 있음
- **mssql / db2 / odbc** — 풀 구현이 통일되어 있지 않아, "정말로 풀에서 빠지는지" 를 어댑터 레벨에서 검증해야 함. 최악의 경우 풀 자체를 자체 구현으로 감싸야 destroy 가 보장됨

이번 추상화는 `IDbProvider.destroy(conn)` 후크 한 개로 격리하므로, 드라이버별 차이는 어댑터 안에 갇히고 호출부는 무관하다.

---

# DB 설계 Q&A

## Q1. `getDb()`를 Class가 아닌 Interface(`IDbClient`) 형태로 사용하는 이유

### (a) 추상화 경계 — Provider 다형성
`IDbClient`는 "DB가 무엇을 할 수 있는가(query/execute/tx)"만 정의하고, **누가 어떻게 하는가**(Oracle / Postgres / MSSQL provider)는 `factory.ts`의 `getProvider(providerName)`에서 런타임에 주입된다. 호출자(Server Action)는 provider 종류를 몰라도 동일한 인터페이스로 작업할 수 있다.

### (b) Decorator/Wrapper 패턴 친화적
`getDb()` 안에서 query/execute/tx 메서드를 직접 구성하며, 각 메서드 본문은 `withLifecycle` 로 감싸 시간 측정/로깅/DbError 변환을 단일 지점에서 처리한다. 클래스 상속이었다면 `class LoggedClient extends RawClient` 같은 강결합이 생기지만, 인터페이스는 **객체 합성(composition)** 만으로 로깅/트레이싱 레이어를 끼워넣을 수 있다. 트랜잭션 내부 호출도 별도 클라이언트를 만들지 않고, `AsyncLocalStorage` 기반 `txStore` 에서 raw 커넥션을 꺼내 provider 로 전달한다.

### (c) 캐싱 · 테스트 · 트리쉐이킹
- **캐싱**: `clientCache: Map<string, IDbClient>` — 인터페이스 타입이라 provider 교체 시에도 시그니처가 바뀌지 않음
- **테스트**: Server Action 테스트에서 `IDbClient`를 만족하는 mock 객체를 그대로 주입 가능 (클래스라면 상속/스파이가 필요)
- **번들**: 인터페이스는 컴파일 시 소거되어 클라이언트 번들에 누수 위험이 없음

### (d) `'use server'` 친화성
서버 액션에서 import되는 표면이 "값(클래스)"이 아니라 **"함수(`getDb`) + 타입(`IDbClient`)"** 이라, 직렬화/번들링 경계가 깔끔하다.

### 정리
*Provider 교체 가능성 + 횡단 관심사(로깅/트레이싱) 합성 + 테스트 용이성* 세 가지를 동시에 얻기 위한 의도적 선택이다.

---

## Q2. C# `OracleConnection.BeginTransaction()` (명시적 begin/commit/rollback) vs 현재 방식 (`db.tx(async () => …)` 콜백 + ALS)

### 현재 방식의 장점

| 항목 | 설명 |
|---|---|
| **누수 불가능** | `db.tx(...)` 가 acquire/commit/rollback/release 라이프사이클을 강제로 책임짐. 호출자가 `commit()`을 잊거나 `rollback()`을 누락하는 버그가 원천 차단됨 |
| **자동 에러 분기** | 콜백이 throw → 자동 rollback, 정상 반환 → 자동 commit. C#의 `try { tx.Commit() } catch { tx.Rollback() }` 보일러플레이트 없음 |
| **트레이싱 통합** | `txTraceId`가 자동 발급되어 트랜잭션 내부 모든 query/execute 로그에 `parentTraceId`로 묶임. C# 방식은 별도 코드로 직접 전파해야 함 |
| **헬퍼 무수정 재사용** | 콜백이 인자를 받지 않고 ALS 로 트랜잭션 커넥션이 흐르므로, `readSal(empno)` 같은 헬퍼가 트랜잭션 안/밖에서 동일한 시그니처로 호출됨. C# 방식은 `tx` 객체를 인자로 일일이 전달해야 함 |
| **중첩/await 누락 가드** | 동일 DB 의 중첩 `tx()` 는 런타임에 차단되고, in-flight 카운터로 `forEach(async)` 같은 await 누락이 자동 검출되어 rollback 됨 |
| **풀/커넥션 추상화** | 호출자가 connection 객체를 직접 다루지 않으므로 connection leak 불가 |

### 현재 방식의 단점

| 항목 | 설명 |
|---|---|
| **세밀한 제어 불가** | C#에서 가능한 *부분 커밋*, *savepoint 후 일부만 rollback*, *조건부 commit 지연* 같은 시나리오를 표현하기 어려움. 현재 인터페이스는 savepoint API가 없음 |
| **트랜잭션 수명이 콜백에 묶임** | C#은 트랜잭션을 메서드 경계 밖으로 반환하거나 여러 사용자 상호작용 사이에 열어둘 수 있으나, 현재 방식은 콜백 종료 = 트랜잭션 종료 |
| **격리 수준/읽기 전용 옵션 부재** | `BeginTransaction(IsolationLevel.Serializable)` 같은 옵션을 현재 시그니처(`fn => Promise<R>`)는 노출하지 않음. 필요 시 `transaction(opts, fn)` 형태로 확장 필요 |
| **콜백 내 비동기 누수 위험** | 사용자가 트랜잭션 콜백 안에서 `setTimeout`이나 외부 Promise를 fire-and-forget 하면, commit 이후 쿼리가 날아가는 버그 가능성 존재 |
| **디버깅 시 단계 추적 어려움** | C#은 `Commit()`에 직접 브레이크포인트를 걸 수 있지만, 현재 방식은 provider 내부로 들어가야 함 |

### 결론
현재 방식은 **"99%의 일반적 트랜잭션 케이스에서 안전성을 강제하는 대신, 1%의 비표준 시나리오(부분 커밋, 장기 트랜잭션, 격리 수준 지정)의 유연성을 포기"** 한 트레이드오프이다. 웹 서버의 Server Action 같은 **단발성 요청-응답 패턴**에서는 현재 방식이 명백히 우월하며, 만약 savepoint나 IsolationLevel이 필요해지면 `QueryOptions`나 `transaction(opts, fn)` 시그니처로 점진적 확장이 가능하다.

---

# DB 실행 흐름 분석

## getDb() 기반 DB 쿼리 실행 흐름

### 1. 정상 루트 (Happy Path)

```
Server Action 호출
  │
  ▼
getDb('MAIN')                          ← factory-new.ts:109
  │
  ├─ 캐시 확인 (clientCache)            ← :110-111
  │   히트 → 캐싱된 client 즉시 반환
  │   미스 ↓
  │
  ├─ resolveFromEnv('MAIN')            ← :113
  │   .env.local에서 DB_CONNECTION__MAIN 파싱
  │   → { providerName, dsn, pool } 반환
  │
  ├─ getProvider(providerName)          ← :122
  │   예: 'oracle' → oracle provider 인스턴스
  │
  ├─ IDbClient 객체 생성               ← :124-160
  │   (query, execute, transaction 메서드 보유)
  │
  └─ clientCache에 저장 후 반환         ← :162-163

  ▼
client.query<T>(sql, binds, opts)       ← :125
  │
  ▼
withLifecycle(...)                      ← :36
  │
  ├─ traceId 생성 (UUID)               ← :48
  ├─ 타이머 시작 (Date.now())           ← :50
  │
  ├─ provider.query() 실행             ← :129
  │   (실제 DB 드라이버가 SQL 실행)
  │
  ├─ 성공 시:
  │   ├─ 소요시간 계산                  ← :54
  │   ├─ log.info('db.ok', {...})      ← :55-64
  │   │   (db명, provider, traceId, 소요시간, SQL, rowCount 로깅)
  │   └─ rows 반환 → Server Action → 클라이언트
  │
  ▼
Server Action이 결과를 직렬화하여 클라이언트에 전달
```

### 2. 에러 루트들

#### 2-A. 환경변수 미설정

```
getDb('UNKNOWN')
  │
  ├─ resolveFromEnv('UNKNOWN') → null   ← :113-114
  │
  └─ throw DbError                      ← :115-118
      category: 'config'
      devMessage: "환경변수 DB_CONNECTION__UNKNOWN 이 설정되지 않았습니다"

→ Server Action의 에러 핸들러(actionAgent 등)가 잡아서 처리
```

#### 2-B. DB 드라이버가 DbError를 던진 경우

```
withLifecycle 내부
  │
  ├─ provider.query() 실행
  │   → DbError throw (예: 연결 실패, SQL 문법 오류 등)
  │
  ├─ catch 블록 진입                    ← :66
  ├─ err instanceof DbError → true      ← :68
  │
  ├─ log.error('db.err', {...})         ← :69-82
  │   category, code, devMessage, cause 모두 로깅
  │
  └─ throw err (원본 그대로 재throw)     ← :83

→ provider가 이미 적절한 category/code를 세팅했으므로 그대로 전파
```

#### 2-C. 예상치 못한 에러 (non-DbError)

```
withLifecycle 내부
  │
  ├─ provider.query() 실행
  │   → TypeError, RangeError 등 일반 에러 throw
  │
  ├─ catch 블록 진입                    ← :66
  ├─ err instanceof DbError → false     ← :68
  │
  ├─ DbError로 래핑                     ← :84-89
  │   category: 'unknown'
  │   devMessage: 'Unhandled error in DB lifecycle'
  │   cause: 원본 에러
  │
  ├─ log.error('db.err', {...})         ← :90-100
  │
  └─ throw wrapped (래핑된 DbError)     ← :101

→ 어떤 에러든 DbError 형태로 통일되어 상위로 전파
```

#### 2-D. 트랜잭션 내부 에러

```
db.tx(async () => {
  await db.query(...)  // 성공 — ALS 컨텍스트의 tx 커넥션에서 실행
  await db.execute(...) // 여기서 에러!
})
  │
  ├─ factory.ts 의 tx() 가 provider.rollback(conn) 호출
  │   (provider 는 commit/rollback/release 4 훅만 제공)
  │
  ├─ withLifecycle의 catch로 전파       ← :148-158
  │   (2-B 또는 2-C 루트와 동일)
  │
  └─ sql: 'TRANSACTION'으로 로깅됨
```

### 흐름 요약 다이어그램

```
Server Action
  └─ getDb(name)
       ├─ [환경변수 없음] → DbError(config)          ··· 2-A
       └─ client 반환
            └─ client.query / execute / transaction
                 └─ withLifecycle
                      ├─ 성공 → 로깅 + 결과 반환       ··· 1
                      ├─ DbError → 로깅 + 재throw      ··· 2-B
                      └─ 기타에러 → DbError 래핑 + throw ··· 2-C
```

**핵심 설계 포인트**: `withLifecycle`이 단일 관문 역할을 하여, 모든 DB 호출이 반드시 로깅되고, 모든 에러가 반드시 `DbError`로 통일되어 나간다. Server Action 측에서는 항상 `DbError`만 상대하면 된다.

---

## 에러 전파 흐름 (DB → 클라이언트)

### 전체 동작 흐름

```
[DB Provider] → DbError throw
       ↓
[factory-new.ts withLifecycle] → DbError 로깅 + 재throw (또는 unknown 에러를 DbError로 래핑)
       ↓
[actionWrapper.ts actionAgent] → catch에서 DbError를 ActionError(plain object)로 변환
       ↓
[Server → Client 직렬화 경계] → ActionResponse<T> envelope로 전달 (plain object이므로 안전)
       ↓
[useAction.ts] → result.error(ActionError)를 new AppError(result.error)로 클래스 복원
       ↓
[globalErrorHandler.ts] → AppError.type으로 분기하여 toast 표시
```

## 에러 클래스 3단계 변환

| 계층 | 타입 | 형태 | 역할 |
|------|------|------|------|
| DB 레이어 | `DbError` | class (extends Error) | 서버 전용. provider raw 에러를 래핑하여 category/code/traceId 부여 |
| 직렬화 경계 | `ActionError` | interface (plain object) | Server Action → Client 전달용. JSON 직렬화 안전 |
| 클라이언트 | `AppError` | class (extends Error) | ActionError로부터 복원. instanceof 체크 및 Error Boundary 전파 가능 |

## 각 파일의 역할

### `lib/db/errors.ts` — DbError

- DB provider가 던지는 raw 에러를 표준화된 `DbError`로 래핑
- `category`: config / connection / timeout / syntax / constraint / permission / unknown
- `message`: 항상 사용자 안전 문구 (`SAFE_PUBLIC_MESSAGE`)
- `cause`: 원본 에러 (서버 로그 전용, 클라이언트 노출 금지)
- `categorizeOracleError()`: Oracle 에러 코드(ORA-XXXXX)를 category로 자동 매핑

### `lib/db/factory-new.ts` — withLifecycle

- 모든 query/execute/transaction의 공통 lifecycle 처리
- 시간 측정, 로깅(`db.ok` / `db.err`), DbError 변환을 한 지점에서 수행
- 이미 DbError인 경우: 로깅 후 재throw
- 미분류 에러인 경우: `category: 'unknown'`으로 DbError 래핑 후 throw

### `lib/utils/server/actionWrapper.ts` — actionAgent

- Server Action을 감싸서 `ActionResponse<T>` envelope으로 직렬화
- DbError → ActionError 변환 시 `DB_CATEGORY_MAP`으로 category를 ErrorType으로 매핑:

| DbError.category | → ActionError.type |
|---|---|
| constraint | db_constraint |
| permission | db_permission |
| config / connection / syntax / timeout / unknown | db_system |

- `devMessage`는 `NODE_ENV === 'development'`일 때만 포함
- DbError는 withLifecycle에서 이미 로깅했으므로 재로깅하지 않음
- 미분류 에러만 `server.action` 이벤트로 1회 로깅

### `lib/utils/client/useAction.ts` — useAction

- 클라이언트에서 Server Action 실행을 위한 훅
- `ActionResponse` envelope을 자동 언래핑
- 실패 시 `ActionError`(plain object) → `new AppError(result.error)`로 클래스 인스턴스 복원
- `onError`에서 `'handled'` 반환 시 전역 토스트 스킵 (자체 처리)

### `lib/utils/client/globalErrorHandler.ts` — handleGlobalError

- `AppError.type`에 따라 toast variant/title 결정:
  - validation / db_constraint / db_permission → warning toast
  - auth / network / timeout / db_system / unknown → error toast
- dev 모드에서 `devMessage` 콘솔 출력
- traceId를 toast에 표시하여 서버 로그와 1:1 매칭 가능

## 필드 전달 매핑 (유실 여부)

DbError의 필드가 클라이언트까지 어떻게 전달되는지:

| DbError | → ActionError | → AppError | 비고 |
|---|---|---|---|
| `category` | `type` (DB_CATEGORY_MAP 변환) | `type` | 세분류가 db_system으로 합산됨 |
| `message` | `message` | `message` (Error.message) | SAFE_PUBLIC_MESSAGE 유지 |
| `code` | `code` | `code` | 그대로 전달 |
| `traceId` | `traceId` | `traceId` | 그대로 전달 |
| `devMessage` | `devMessage` | `devMessage` | dev 모드에서만 포함 |
| `cause` | (전달 안 됨) | (없음) | 의도적 차단 — 서버 로그에만 존재 |

**결론: DbError의 `cause`를 제외한 모든 필드는 클라이언트까지 도달한다.**
`cause`는 보안상 의도적으로 서버에서만 로깅하고 클라이언트로 전달하지 않는다.

## 설계 특징

- **직렬화 경계 분리**: DbError(서버) → ActionError(plain object) → AppError(클라이언트)로 각 계층 역할이 명확
- **팀원 편의**: actionAgent가 모든 에러를 envelope로 감싸므로 Server Action 내부에 try/catch 불필요
- **중복 로깅 방지**: DbError는 withLifecycle에서 1회 로깅, 미분류 에러만 actionWrapper에서 로깅
- **보안**: cause(원본 에러 스택)는 클라이언트에 노출하지 않음, devMessage는 dev 모드에서만 전달

---

## useAction 사용 가이드라인

### useAction이 적합한 경우

| 계층 | `useAction` 사용 | 이유 |
|------|:-:|------|
| 페이지/feature에서 이벤트 핸들러 호출 | **O** | 로딩 + envelope 언래핑 + 에러 일괄 처리 |
| `dataSource` props로 Server Action을 받는 공용 컨트롤 | **O** | 컴포넌트가 Action 내부 구현을 모른 채 실행만 위임 |

### useAction이 불필요하거나 부적합한 경우

| 계층 | `useAction` 사용 | 이유 |
|------|:-:|------|
| `<form action={...}>` / `useActionState` | **X** | React가 pending 상태를 관리, envelope만 직접 언래핑 |
| Server Component | **X** | 클라이언트 훅 사용 불가 |
| 순수 UI 공용 control 컴포넌트 (Button, Input 등) | **X** | Action을 모르는 순수 UI여야 함 |

### 핵심 원칙

- `actionAgent`(서버 래퍼)는 **모든** Server Action에 필수
- `useAction`(클라이언트 훅)은 **이벤트 핸들러에서 직접 호출할 때** 사용
- `dataSource` props로 Server Action을 받는 공용 컨트롤도 `useAction` 사용 가능

### dataSource 패턴 — 공용 컴포넌트에서 Server Action을 실행하는 경우

공용 컴포넌트가 **직접 비즈니스 로직을 아는 것**이 아니라, **외부에서 주입받은 함수를 실행**하는 것이므로 관심사 분리 원칙에 위배되지 않는다.

```tsx
interface AsyncSelectProps {
  dataSource: (keyword: string) => Promise<ActionResponse<Option[]>>
  onSelect?: (value: string) => void
}

function AsyncSelect({ dataSource, onSelect }: AsyncSelectProps) {
  const { execute, isLoading } = useAction()
  const [options, setOptions] = useState<Option[]>([])

  const handleSearch = (keyword: string) =>
    execute(() => dataSource(keyword), {
      onSuccess: setOptions,
    })
}
```

**주의**: `dataSource` props의 타입을 반드시 `ActionResponse<T>`를 반환하는 함수로 강제해야 한다.

```tsx
// O — envelope 계약을 명시
dataSource: (keyword: string) => Promise<ActionResponse<Option[]>>

// X — useAction이 envelope을 언래핑할 수 없음
dataSource: (keyword: string) => Promise<Option[]>
```
