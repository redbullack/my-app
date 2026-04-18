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
client.transaction(async (tx) => {
  await tx.query(...)  // 성공
  await tx.execute(...) // 여기서 에러!
})
  │
  ├─ provider.withTransaction 내부에서
  │   에러 발생 → ROLLBACK 수행 (provider 책임)
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
