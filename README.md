# Next.js 16 App Router Practice Framework

Next.js 16의 모든 App Router 기능을 학습하고 체험할 수 있는 **포괄적인 연습용 프레임워크**입니다.

## 🎯 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **목적** | Next.js 16 App Router 전체 기능 학습 및 실습 |
| **프레임워크** | Next.js 16 (App Router) |
| **UI 라이브러리** | React 19 |
| **스타일링** | TailwindCSS 4 |
| **언어** | TypeScript (strict mode) |
| **패키지 매니저** | pnpm |

## 🗂️ 포함된 라우팅 패턴

이 프레임워크는 Next.js App Router의 **모든 라우팅 패턴**을 실제 동작하는 예제로 구현합니다.

### 기본 라우팅
- **Static Route** — `/` (홈페이지)
- **Dynamic Segment** — `/blog/[slug]` (동적 매개변수)
  - `generateStaticParams()` 활용한 SSG 구현
  - 세그먼트별 `loading.tsx` 로딩 상태

### 고급 라우팅
- **Catch-all** — `/shop/[...categories]` (다단계 경로 캡처)
- **Optional Catch-all** — `/docs/[[...slug]]` (루트 포함 선택적 캡처)
  - Server/Client 컴포넌트 분리: `page.tsx`(Server)가 params를 처리, `DocsContent.tsx`(Client)가 사이드바 토글 UI 담당

### 레이아웃 그룹화
- **Route Group** — `(marketing)` 그룹: `/about`, `/pricing`
- **Route Group** — `(dashboard)` 그룹: `/dashboard`, `/settings` (사이드바 레이아웃)

### 병렬 & 가로채기
- **Parallel Routes** — `/feed` 페이지
  - `@feed` 슬롯 (피드 목록) — 슬롯 전용 `error.tsx`로 독립적 에러 처리 데모
  - `@stories` 슬롯 (사이드 스토리) — 슬롯 전용 `loading.tsx`로 3초 지연 로딩 데모
  - 슬롯별 독립적 로딩/에러 처리: 한 슬롯의 에러/로딩이 다른 슬롯에 영향 없음
- **Intercepting Routes** — `/gallery`
  - Link 클릭: 모달로 가로채기 `@modal/(.)gallery/[id]`
  - 직접 URL: 전체 페이지 `/gallery/[id]`

### Special Files
- `loading.tsx` — Suspense 기반 로딩 스켈레톤 (슬롯 단위 적용 포함: `@stories/loading.tsx`)
- `error.tsx` — 전역 에러 바운더리 (슬롯 단위 적용 포함: `@feed/error.tsx`)
- `not-found.tsx` — 404 처리
- `default.tsx` — Parallel Routes fallback

### API & 프록시
- **Route Handler** — `/api/hello`, `/api/revalidate`, `/api/emp` (Oracle DB 연동, GET)
- **Dynamic Segment Route Handler** — `/api/emp/[action]` (Oracle DB 연동, POST)
- **Proxy** — 전역 요청 가로채기 및 헤더 조작 (Next.js 16에서 `middleware.ts` → `proxy.ts`로 변경)
  - **현업 활용 패턴 가이드** — `proxy.ts` 주석에 11가지 대표 활용 패턴 상세 문서화: 인증/인가(RBAC), i18n 리다이렉트, A/B 테스트, Bot 감지, Rate Limiting, Geo Routing, 보안 헤더 주입, URL Rewrite, 요청/응답 로깅·트레이싱, 유지보수 모드, 리다이렉트 맵
  - **성능 주의사항** — 외부 I/O 최소화·무거운 연산 금지·matcher 최적화·early return 구조·관심사 분리 원칙 5가지 가이드라인 주석 추가
- **Private Folder** — `_components` (라우팅 제외)

### 대량 데이터 처리
- **Virtualization + Cascading Select** — `/search` 페이지
  - 좌측 `SearchPanel`에 ITEM-A/B/C 캐스케이딩 멀티셀렉트 (각 수천 건, 가상화 적용)
  - `Input type="select"` — `@tanstack/react-virtual` 기반 가상화 드롭다운 멀티셀렉트
  - 단일 `handleItemChange` 핸들러로 A→B→C 캐스케이딩 의존성 처리 (하위 선택값 자동 초기화)
  - `fetchItemDataSource` Server Action으로 Oracle DB `CONNECT BY LEVEL` 기반 데이터소스 조회
  - 메인 그리드에도 `@tanstack/react-virtual` 가상화 적용 (최대 50,000건)
- **useTransition + Compound Component** — `/comp-search` 페이지
  - 두 개의 독립적인 `useTransition` 훅으로 Grid와 Chart를 동시에 조회
  - 각각 먼저 완료되는 순서대로 스켈레톤이 해제되어 표시 (React 19 async `startTransition` 활용)
  - `CompGrid` — 가상화 데이터 그리드 (Compound Component 패턴, 내장 스켈레톤 자동 렌더링)
  - `CompChart` — 순수 CSS/HTML 수평 막대 차트 (외부 라이브러리 없음, 내장 스켈레톤 자동 렌더링)
  - Grid/Chart Route Handler(`/api/comp-search/grid`, `/api/comp-search/chart`)로 완전 독립 병렬 HTTP 요청
  - `lib/search-queries.ts` — Route Handler 전용 DB 조회 모듈 분리
  - **에러 처리**: Server Action 실패 시 `fatalError` 상태를 throw하여 가장 가까운 `error.tsx`(Error Boundary)로 전파. `.catch`/`.finally` 패턴으로 로딩 상태 안정적 해제
- **useActionState + useMemo 캐스케이딩 DataSource** — `/new-search` 페이지
  - React 19 `useActionState` 기반 비동기 상태(pending/data) 자동 관리. 수동 Promise/`useRef` 핸들링 제거
  - `useMemo`로 선언적 캐스케이딩 DataSource 구성 (i1 정적 → i2/i3/i4/i6 Server Action `.bind()`)
  - `Input` 단일 `onChange(selected, id)` 핸들러로 6개 Input 분기 처리 — 두 번째 인자로 Input의 `id`가 전달됨
  - `CompGrid` **셀 더블클릭** 이벤트(`onCellDoubleClick`) 지원 — 클릭한 셀 기준으로 차트를 재조회하는 드릴다운 패턴
  - 검색 버튼 vs 셀 더블클릭을 단일 차트 Action에서 payload(`{ type: 'SEARCH' | 'CELL_DOUBLE_CLICK' }`)로 분기
  - `Tab`/`TabSub`로 Grid/Chart 결과 영역 분리
  - **에러 격리**: `useActionState` 상태에 `{ data, error }` 래핑 도입 — Grid/Chart 각각 독립적으로 에러 상태 보관, 한쪽 실패가 다른 쪽에 영향 없음
  - **렌더링 에러 격리**: `CompGrid` 내부에 `ErrorBoundary`가 자동 내장되어 사용처에서 별도 래핑 불필요 — 렌더 단계 에러 발생 시 그리드 영역만 자동으로 fallback UI로 대체, `errorFallback`/`onError` props로 커스터마이징 가능. `CompChart` 영역은 기존대로 사용처 `ErrorBoundary` 래핑 유지
- **TUI Grid + Function dataSource + Suspense** — `/test-0409` 페이지
  - `tui-grid` 기반의 `Grid` 컴포넌트 신규 추가 (`components/control/Grid.tsx`)
  - `dataSource`로 배열, Promise, 동기/비동기 함수 모두 허용 — 비동기 시 React 19 `use()` + `<Suspense>`로 `GridSkeleton` fallback 자동 처리
  - 컬럼 정의(`columns`) 미전달 시 데이터 키에서 자동 추론
  - TUI Grid 정렬·필터·인라인 편집·체크박스·컬럼 리사이즈 지원
  - `applyGridTheme()`으로 CSS 변수 테마 토큰을 TUI Grid에 동적 적용 (라이트/다크 모드 자동 대응)
  - `tui-grid` CSS는 Turbopack 파서 호환 문제로 `public/tui-grid.css`를 런타임 `<link>` 주입 방식으로 로드
  - `SearchPanel`에 DNAME → JOB → ENAME 3단계 cascade `Input type="select"` 구성
  - `useDataSource` 훅 추가 (`lib/hooks/useDataSource.ts`) — 배열/Promise/함수형 dataSource를 통합 처리하는 범용 훅 (data/isLoading/error 반환)
  - **Tab Master-Detail 패턴** — Tab 1(조회) + Tab 2(편집) 구성; 체크박스/더블클릭으로 선택한 행을 Tab 2에 전달, `useSearchParams`로 탭 인덱스를 URL 쿼리(`?tab=`)에 반영
  - **인라인 편집 → DB UPDATE** — ENAME·SAL·COMM 컬럼 인라인 편집 후 변경사항 확인 모달을 통해 `updateEmpRows` Server Action으로 `SCOTT.EMP` 테이블 UPDATE
  - **Grid 개선** — `onCheckChange(checkedRows)` 통합 콜백(check/uncheck/checkAll/uncheckAll 모두 처리), `onCellDoubleClick` 이벤트에 `rowData` 추가, 정렬 시 스켈레톤 오버레이(sort blocking 방지), `IntersectionObserver` 기반 탭 전환 시 `refreshLayout` 자동 호출
  - **`onModifiedRows` 콜백 추가** — Grid 내부에서 변경 추적(스냅샷·변경맵)을 자동 관리. `ModifiedRow[]` 타입(`rowKey`, `rowData`, `changes: { before, after }`)으로 변경된 행만 필터링하여 콜백. `resetData` 시 스냅샷 자동 갱신 및 변경맵 초기화. `/test-0409` 페이지의 수동 `ChangesMap`/`originalRowsRef` 로직을 제거하고 `onModifiedRows={setModifiedRows}`로 대체
  - **`useErrorHandler` 연동** — `useErrorHandler` 훅을 import하여 이벤트 핸들러/async 코드의 에러를 가장 가까운 `error.tsx`로 전파하는 패턴 적용. `throwError(err)` 호출로 클라이언트 에러 분류·로깅·전파를 통합 처리
  - **Grid `useRef` 기반 resource 관리 (버그 수정)** — `useMemo`는 Suspense suspend/retry 시 캐시가 폐기되어 함수형 `dataSource`에서 무한 루프가 발생하는 문제를 `useRef`로 교체하여 해결. suspend 재시도에서도 동일 Promise 참조를 보장하며, Server Action 렌더 중 호출 시 발생하는 Router `setState` 경고를 `Promise.resolve().then()`(microtask 지연)으로 방지
  - **`/test-0409` 검색 패턴 개선** — `setGridDataSource(fetchEmpList(cond))` (즉시 Promise 생성) 방식에서 `setGridDataSource(() => fetchEmpList.bind(null, cond))` (함수형 dataSource) 방식으로 변경하여 Suspense 트리거를 상태 업데이트 이후로 안전하게 지연. `gridDataSource` 상태 타입에 `() => Promise<EmpRow[]>` 추가
  - **`addToDetail` 로직 단순화** — 중복 EMPNO 필터링 및 행 누적을 담당하던 `addToDetail` 헬퍼를 제거하고, 선택 편집 시 `setDetailRows(empRows)` + `setModifiedRows([])` 직접 호출로 교체. 행 교체(replace) 의미를 더 명확하게 표현
- **Oracle Transaction Commit/Rollback 검증** — `/test-0419` 페이지
  - `lib/db/providers/oracle.ts`의 `db.transaction()` (withTransaction) 동작을 실제로 검증하는 테스트 라우트
  - **Commit 테스트** — 두 건의 `SCOTT.EMP.SAL`을 `+delta`만큼 증감하는 UPDATE 두 개를 단일 트랜잭션 콜백에서 실행, 정상 종료 시 두 건 모두 반영되는지 before/after SAL 비교
  - **Rollback 테스트** — 동일한 두 건 UPDATE 실행 후 콜백 내부에서 `__forced_rollback__` 에러를 고의로 throw → 두 건 모두 원복되는지 확인. sentinel 에러 메시지만 catch 처리하여 삼킴 처리, 그 외 에러는 재전파
  - `runTxCommit` / `runTxRollback` Server Action이 `db.transaction(async tx => ...)` 콜백 내에서 `tx.query` / `tx.execute`로 동일 커넥션 위에서 다중 쿼리를 원자적으로 실행함을 보여줌
  - `TxTestResult` 타입(`committed`, `beforeA/B`, `afterA/B`)을 Panel에 표 형태로 노출하여 커밋/롤백 전후 값을 시각적으로 비교
  - `factory-new.ts`(환경변수 기반 DB 팩토리)의 `MAIN` 커넥션을 사용 — 레지스트리·암호화 없이 `.env.local`의 `DB_CONNECTION__MAIN`만으로 동작
  - `fetchEmpSimple` 함수형 dataSource(`() => fetchEmpSimple.bind(null)`)로 Grid에 전달하여 Suspense 기반 비동기 로딩 패턴 재확인

### DB 연동
- **Oracle DB 통합** — scott.emp 테이블 조회 예제
  - `/emp` 페이지: MultiSelect 필터로 사원명 선택 및 조회 (Server Action / GET / POST 세 가지 방식 비교)
  - `/api/emp` Route Handler: WHERE IN 동적 쿼리 구성 (GET)
  - `/api/emp/[action]` Dynamic Segment Route Handler: Body로 enames 배열을 전달하는 POST 방식 조회 (`/api/emp/search`)
  - `lib/db/` 모듈: DB 팩토리 및 헬퍼 함수 (아래 상세 참고)

### DB 레이어 아키텍처 (`lib/db/`)
- **`getDb(name)` 팩토리 (레지스트리 방식)** — `lib/db/factory.ts`. 레지스트리 조회 → DSN 복호화 → 프로바이더 선택 → lifecycle 래핑(로그·에러 변환)을 단일 진입점에서 처리. 인스턴스 캐싱으로 중복 풀 생성 방지
- **`getDb(name)` 팩토리 (환경변수 방식)** — `lib/db/factory-new.ts`. `.env.local`의 `DB_CONNECTION__<NAME>` 환경변수에서 접속 정보를 해석하는 경량 팩토리. `databases` 레지스트리·`secret.ts` 암호화 의존 없이 동일한 lifecycle(로깅·에러 래핑·캐싱·종료 훅) 제공. ADO.NET 스타일 connectionString(`User ID=...;Password=...;Data Source=...;Min Pool Size=...`) 파싱 지원
- **환경변수 Resolver** — `lib/db/resolvers/env.ts`. `DB_CONNECTION__<NAME>` 환경변수의 JSON 값에서 `providerName`과 ADO.NET 스타일 `connectionString`을 파싱하여 `ResolvedDsn` + `PoolOptions` 반환. `User ID`, `Password`, `Data Source`, `Min Pool Size`, `Max Pool Size`, `Pool Increment` 키 지원
- **DB 실행 흐름 문서** — `lib/db/config/flow.md`. `getDb()` → `resolveFromEnv()` → `provider.query()` → `withLifecycle()` 로깅까지의 전체 실행 흐름을 다이어그램으로 문서화
- **DB 레지스트리** — `lib/db/config/databases.ts`. C# DB.config XML 방식에서 영감을 받은 type-safe 레지스트리. `DbName` literal union으로 오타 시 컴파일 에러. `encrypt: true` 항목은 암호화된 ciphertext만 저장 가능
- **표준 에러** — `lib/db/errors.ts`. 모든 provider raw 에러를 `DbError`(category/code/traceId/cause)로 래핑하여 상위로 전파. `.message`는 항상 클라이언트 안전 문구, `cause`는 서버 로그 전용
- **Oracle 프로바이더** — `lib/db/providers/oracle.ts`. connection pool 기반 쿼리 실행, Oracle 에러 코드 → `DbErrorCategory` 자동 분류, `transaction()` 지원
- **구조화 로거** — `lib/db/logger.ts`. 쿼리 시작·완료·에러를 JSON 형태로 출력. 개발 환경에서 SQL preview(첫 120자) 및 바인드 파라미터 shape 노출
- **connectString 암호화** — `lib/db/secret.ts` + `scripts/db-encrypt.mjs`. AES-256-GCM 방식. `DB_CONFIG_SECRET` 환경변수(32 bytes hex) 로 암·복호화. `enc:v1:<iv>:<tag>:<cipher>` 포맷
- **하위 호환 shim** — `getDbClient()` deprecated 래퍼를 `lib/db/index.ts`에 유지하여 기존 호출부 무수정 마이그레이션 지원
- **`db.query()` 반환 타입 변경 — `QueryResult<T>`** — `T[]` 대신 `{ columns, rows }` 구조의 `QueryResult<T>`를 반환하도록 `IDbClient` / `IDbProvider` 시그니처를 변경. `columns`는 `{ name, type: 'string' | 'number' | 'date' }[]` 형태의 컬럼 메타데이터로, Oracle `dbTypeName`(`NUMBER`/`DATE`/`TIMESTAMP*`/`VARCHAR2` 등)을 통합 타입으로 매핑하여 제공. 클라이언트에서 동적 그리드 컬럼 구성·타입 기반 포매팅 등에 활용 가능. `tx.query()`(트랜잭션 내부)도 동일한 구조로 반환. 호출부는 `const { rows } = await db.query(...)` 패턴으로 분해 사용
- **기본 팩토리 전환** — `lib/db/index.ts`의 `getDb` 재-export를 `./factory`(레지스트리 방식)에서 `./factory-new`(환경변수 방식)로 전환. `.env.local`의 `DB_CONNECTION__<NAME>`만으로 DB 접속이 구성되며, 레지스트리·`secret.ts` 암호화 의존성 없이 동작. 기존 레지스트리 팩토리는 `lib/db/factory.ts`에 보존되어 필요 시 직접 import 가능

### 클라이언트 에러 처리 아키텍처 (`lib/utils/type`, `lib/utils/client/`)

Server Action → Client 사이의 에러를 직렬화 경계를 고려하여 `ActionError`(plain object)와 `AppError`(class) 두 계층으로 분리한 에러 프레임워크.

#### 타입 계층 — `lib/utils/type/index.ts`

| 타입 | 종류 | 용도 |
|------|------|------|
| `ActionError` | `interface` (plain object) | Server Action 직렬화 경계. `ActionResponse` envelope에 포함. JSON 직렬화 가능 |
| `AppError` | `class extends Error` | 클라이언트에서 `new AppError(serialized)`로 복원. `instanceof` 체크 및 Error Boundary 전파용 |

- `ActionError` 필드: `type: ErrorType`, `message`, `traceId`, `code?`, `devMessage?`
- `AppError` 생성자: `new AppError(actionError)` — `ActionError`에서 클래스 인스턴스로 복원
- `ErrorType` 분류: `validation` · `auth` · `network` · `timeout` · `db_constraint` · `db_permission` · `db_system` · `unknown`

#### 서버 측 — `lib/utils/server/actionWrapper.ts`

- `actionAgent<T>(fn, name)` — Server Action을 `ActionResponse<T>` envelope로 래핑
- 내부에서 catch된 에러를 `ActionError`(plain object)로 변환하여 반환
- `DbError` → `ActionError.type` 자동 분류 (DB_CATEGORY_MAP)
- 팀원은 Server Action 내부에 `try/catch` 없이 정상 경로만 작성
- 확장 포인트(주석): `AuthError`, `ZodError`, `AbortError`, `FetchError` 등 커스텀 에러 분기 예시 포함

#### 클라이언트 측 — `lib/utils/client/`

**`useAction` 훅** (`lib/utils/client/useAction.ts`):
- `ActionResponse`의 `error`(ActionError plain object)를 `new AppError()`로 클래스 인스턴스로 복원
- `onError?: (error: AppError) => 'handled' | void` — 반환값이 `'handled'`면 전역 핸들러 호출 스킵
- `silent: true`면 실패 시 전역 토스트 출력 없음
- `throwToBoundary: true`면 실패 시 내부 `setState` 콜백에서 에러를 `throw`하여 가장 가까운 `error.tsx`(React Error Boundary)로 전파. 이벤트 핸들러의 비동기 에러도 Boundary에 도달 가능하게 하는 공식 패턴. `silent`·`handled` 반환 시에는 전파하지 않음

**`handleGlobalError`** (`lib/utils/client/globalErrorHandler.ts`):
- `AppError` 또는 일반 `Error`를 받아 분류별 Toast UI 출력
- `AppError instanceof` 체크 기반 분기 (isAppError duck-typing 함수 제거)
- `useAction` 및 `Grid` envelope 언래핑 실패 시 자동 호출 — 팀원이 직접 호출하지 않음

#### 에러 전파 경로

| 에러 발생 위치 | error.tsx 도달 방법 | 파일 |
|----------------|---------------------|------|
| 렌더링 중 (`use()`, JSX) | **자동** — React Error Boundary가 캐치 | — |
| Grid envelope 언래핑 실패 | `handleGlobalError(new AppError(actionError))` 후 `throw` | `components/control/Grid.tsx` |
| `useAction` 실패 | `new AppError(result.error)` → `handleGlobalError` 또는 `onError` 콜백 | `lib/utils/client/useAction.ts` |
| window 전역 미처리 | **로깅만** (Error Boundary 도달 불가) | `components/providers/GlobalErrorCatcher.tsx` |

#### error.tsx의 AppError 인식

`app/error.tsx` 및 `app/test-case/error.tsx`가 `AppError`를 감지하면 추가 정보를 표시:
- `type` Badge (예: `validation`, `db_system`)
- `traceId` 전체 값 (서버 로그와 1:1 매칭이 가능하도록 잘라내지 않고 그대로 노출)
- `console.error`로 로그 출력

#### Server Action과 직렬화 경계 설계

Server Action → Client 직렬화 과정에서 클래스 인스턴스의 커스텀 필드가 소실되는 문제를 두 계층 분리로 해결:
- 서버: `ActionError` (plain object) — JSON 직렬화 가능, `ActionResponse.error`에 포함
- 클라이언트: `new AppError(serialized)` — 클래스 인스턴스로 복원, `instanceof` 체크 가능

```tsx
// Server Action (actionWrapper.ts가 자동으로 ActionError로 변환)
export const myAction = () => actionAgent(async () => { ... }, 'myAction')

// Client (useAction이 자동으로 AppError로 복원)
const { execute } = useAction()
execute(myAction, {
  onSuccess: (data) => { ... },
  onError: (appError) => {
    console.log(appError.type, appError.traceId)  // instanceof AppError 체크 가능
    return 'handled'
  }
})
```

#### React 19 `use()` 훅과 에러 전파

`use()` 훅으로 Promise를 unwrap하면 **렌더링 단계에서** reject가 발생하므로, Error Boundary가 자동으로 캐치한다:

```tsx
// Server Component에서 Promise를 prop으로 전달
const dataPromise = fetchData()  // Promise<Data>
<ClientComponent dataPromise={dataPromise} />

// Client Component에서 use()로 unwrap
const data = use(dataPromise)  // reject 시 → 렌더링 에러 → error.tsx 자동 전파
```

## 🧪 에러/예외 재현 테스트 페이지 (`/test-case`)

Next.js 16 + React 19 환경에서 발생 가능한 **모든 에러 경로**를 실제로 트리거하여 처리 흐름을 관찰할 수 있는 종합 테스트 라우트입니다. (최근 커밋: `6b81fa5 test-case 페이지 추가 / instrumentation 파일 2개 추가`)

### 구성

- **`app/test-case/page.tsx`** — 카테고리(A: Server Action / B: 클라이언트 런타임 / C: Route Handler / D: Fetch 실패) × 케이스 × 에러 타입 드롭다운을 선택해 버튼 한 번으로 해당 시나리오를 재현. 실행 결과를 하단 Grid(`CompGrid`)에 NO/시각/카테고리/케이스/에러 타입/메시지/처리 위치/상세 컬럼으로 누적 기록
- **`app/test-case/_actions/index.ts`** — Server Action 전용 에러 재현 집합 (`'use server'`): DB 카테고리별 `DbError` throw, unknown 에러, Promise reject, sync throw 등. 클라이언트에서 `try/catch` + `throwError()`로 `error.tsx`까지 전파
- **`app/test-case/_components/HydrationMismatch.tsx`** — `typeof window` / `Math.random()`을 JSX 본문에서 직접 사용해 서버/클라이언트 첫 렌더 결과가 달라지도록 구성 → React 19 `onRecoverableError` 경고 유발 (recoverable)
- **`app/test-case/_components/ThrowOnRender.tsx`** — 렌더 단계에서 즉시 throw하여 가장 가까운 `error.tsx`(Error Boundary)로 강제 전파
- **`app/test-case/api/route.ts`** — Route Handler 레벨 에러 재현 (`?case=...`): 400/401/403/404/409/500, JSON 파싱 실패, timeout, DB 에러 변환 등
- **`app/test-case/error.tsx`** — test-case 전용 Error Boundary. `AppError` 인식 시 type/traceId/devMessage 표시, `reset()` 버튼 제공
- **`app/test-case/b2/page.tsx`** — B-2 Hydration Mismatch **전용 재현 라우트**. 메인 `/test-case`에서 진입 시 이미 hydrated 상태라 경고가 나지 않는 문제를 해결하기 위해, 서버 렌더부터 mismatch가 발생하는 독립 페이지로 분리. `/test-case/b2` 직접 진입/새로고침 시 DevTools Console에서 "Hydration failed..." 경고 확인 가능

### Instrumentation 2종 (루트 예제)

- **`_instrumentation.ts`** — Next.js `register()` / `onRequestError()` 훅 예제. 서버 에러 중앙 수집·외부 APM(Sentry/Datadog) 연동·traceId 발급 패턴을 주석으로 문서화
- **`_instrumentation-client.ts`** — 클라이언트 부팅 시점의 전역 리스너 초기화 예제 (`window.onerror`, `unhandledrejection`, React `onRecoverableError`)

두 파일 모두 현재는 `_` 프리픽스로 비활성화 상태이며, 실제 활성화 시 프로젝트 루트의 `instrumentation.ts` / `instrumentation-client.ts`로 리네임해 사용합니다.

### 부수 변경

- **`components/providers/GlobalErrorCatcher.tsx`** — 클라이언트 전역 에러/rejection을 캐치해 `getClientLogger().error()`로 구조화 로깅 후 선택적으로 error.tsx까지 전파
- 문서화 주석 정리: `app/test-case/page.tsx`, `error.tsx`, `HydrationMismatch.tsx` 상단의 장황한 TailwindCSS 설명 주석을 제거해 본문 주석을 간결화

## 🔐 인증 시스템

### next-auth Credentials 인증
- **`/login`** 페이지: Oracle EMP 테이블의 사원명(ENAME)으로 로그인
  - `LoginForm` Client Component — `Input`, `Button`, `Panel` 컨트롤 재사용
  - `signIn('credentials', { redirect: false })` 로 인증 후 `/dashboard` 리다이렉트
  - 로그인 폼에 테스트 계정(`SMITH` / `password123`) 기본값 제공으로 즉시 체험 가능
  - 실패 시 에러 메시지 인라인 표시

### SSO 전환 가이드 (인-코드 문서화)
- **`lib/auth/auth.ts`** — 사내 SSO(OIDC/SAML) 전환 시 참고할 수 있는 상세 주석 추가
  - Provider 교체 예시: Azure AD (Entra ID), Okta, 범용 OIDC (Keycloak 등)
  - `authorize()` 함수 불필요화 및 jwt callback 내 DB 동기화 패턴 안내
  - **JWT Callback 보안 가이드** — 토큰에 세팅하면 좋은 값 / 위험한 값 / 편리한 값 분류 정리
    - 권장: `permissions`, `department`, `loginIp`, `loginAt`, `mfaVerified`
    - 금지: `password`, `ssoAccessToken`, `ssn`, `dbConnectionString`
    - 유틸: `locale`, `timezone`, `avatarUrl`, `displayName`
  - **Session Callback 보안 가이드** — 클라이언트 노출 최소 권한 원칙 적용
    - 안전: `id`, `name`, `role`, `empno`, `department`, `avatarUrl`, `locale`
    - 금지: `permissions`(공격 표면), `accessToken`(SSO 토큰), `loginIp`(개인정보)
  - SSO 전환 시 `account`, `profile` 파라미터 활용 예시 (그룹/역할 매핑, access_token 서버 스토어 보관)
  - `sliding window` 토큰 갱신 로직 유지 (발급 후 10분 경과 시 `issuedAt` 갱신)
- **`types/next-auth.d.ts`** — SSO 도입 시 확장 가능한 타입 필드 주석으로 문서화
  - `User` — `permissions`, `mfaVerified`, `department`, `avatarUrl`, `locale`, `timezone`, `displayName`
  - `Session.user` — 클라이언트 노출 안전 필드 vs 절대 금지 필드 구분
  - `JWT` — 보안 권장 / 유틸 편의 / 절대 금지 필드 분류

## 🎨 테마 시스템

### 3가지 테마 모드
- **Light** — 밝은 테마
- **Dark** — 어두운 테마
- **System** — OS 시스템 설정 자동 감지

### 구현 방식
- **CSS 변수 기반** — `--color-bg-primary`, `--color-text-primary` 등
- **TailwindCSS v4** — `@theme inline` 지시어로 테마 토큰 등록
- **동적 토글** — `<ThemeToggle>` 컴포넌트로 실시간 전환
- **localStorage 저장** — 새로고침 후에도 테마 유지
- **FOUC 방지** — 인라인 스크립트로 초기 테마 즉시 적용

모든 컴포넌트는 테마 토큰 색상을 사용하여 라이트/다크 모드에서 자동 대응합니다.

## 🧩 컴포넌트 아키텍처

### Control 컴포넌트 (`components/control/`)
재사용 가능한 UI 컨트롤들:
- **Button** — variant(primary/secondary/ghost/danger), size(sm/md/lg)
- **Input** — label, error, helperText, 다양한 type 지원 (`text`/`password`/`email`/`number`/`search`/`select`). `select` 타입은 `@tanstack/react-virtual` 기반 가상화 드롭다운 멀티셀렉트 제공. 로컬 상태(`localValue`) 기반으로 드롭다운 닫힘 시점에만 `onChange` 호출하며, 키보드 탐색(Enter/Esc/Arrow) 완전 지원. `dataSource`는 `SelectOption[]` / `string[]` / `() => Promise<...>` 모두 허용(내부 정규화). `onChange(selected, id)`로 Input의 `id`를 두 번째 인자로 함께 전달하여 단일 핸들러 분기 가능
- **Select** — options 배열 기반, placeholder 지원
- **Panel** — variant(default/outlined/elevated) 컨테이너
- **Badge** — variant(info/success/warning/error) 상태 표시
- **Modal** — 오버레이 + ESC 키 닫기 지원
- **MultiSelect** — 체크박스 기반 멀티셀렉트 (scott.emp 조회 필터용)
- **Tab** — Uncontrolled/Controlled 탭 전환 UI. `TabSub` 자식의 `label`을 읽어 탭 헤더 렌더링. 모든 탭 콘텐츠를 항상 DOM에 마운트하여 탭 전환 시 내부 상태 유지
- **TabSub** — `Tab`의 자식 마커 컴포넌트. `label` prop을 탭 헤더에 표시하고 `children`을 탭 패널로 렌더링
- **SearchPanel** — 좌측 고정 검색 패널 컨테이너. `children`으로 검색 조건 컨트롤을 받고, Search 버튼 클릭 시 `onSearchClick` 콜백 호출. `isLoading` 상태 지원
- **CompGrid** — 가상화 데이터 그리드 (Compound Component 패턴). `loading` prop이 true이면 내장 스켈레톤 자동 렌더링. `<Suspense>` 래핑 불필요. `CompGrid.Skeleton` 단독 사용 가능. `GridColumn` 타입으로 컬럼 구성, `render` 함수로 셀 커스터마이징 지원. `onCellDoubleClick(value, column, row, rowIndex)` prop으로 셀 더블클릭 드릴다운 지원(핸들러 지정 시 셀에 `cursor-pointer` 자동 적용). **내장 `ErrorBoundary`로 렌더 에러 자동 격리** — 사용처에서 별도 래핑 불필요하며, `errorFallback` prop으로 커스텀 fallback UI 지정, `onError` prop으로 외부 로깅/모니터링 서비스 연동 가능
- **CompChart** — 순수 CSS/HTML 수평 막대 차트 (Compound Component 패턴). 외부 차트 라이브러리 없음. `loading` prop으로 내장 스켈레톤 자동 렌더링. `CompChart.Skeleton` 단독 사용 가능
- **Grid** — `tui-grid` 기반 데이터 그리드 컴포넌트. `dataSource`로 배열/Promise/함수(동기·비동기) 모두 허용. 비동기 시 React 19 `use()` + `<Suspense>`로 `GridSkeleton` fallback 자동 처리. 컬럼 미전달 시 데이터 키에서 자동 추론. 정렬·필터·인라인 편집·체크박스·컬럼 리사이즈·frozenColumn 지원. `onCellDoubleClick`(이벤트에 `rowData` 포함)·`onCheckChange`(체크 전체 변경 통합 콜백)·`onAfterChange`·`onModifiedRows`(`ModifiedRow[]` 자동 추적, before/after 포함) 이벤트 props 제공. 정렬 시 스켈레톤 오버레이로 UI 블로킹 방지. `IntersectionObserver`로 탭 전환 등 display 복원 시 `refreshLayout` 자동 호출. CSS 변수 테마 토큰 자동 적용 (라이트/다크 대응). `ModifiedRow` 타입 export

배럴 익스포트로 간편하게 import:
```tsx
import { Button, Input, Select, Panel, Badge, Modal, MultiSelect, Tab, TabSub, SearchPanel, CompGrid, CompChart, Grid } from '@/components/control'
```

### Layout 컴포넌트
- **Header** — 전역 네비게이션 + 테마 토글
  - Overflow Nav: ResizeObserver 기반 반응형 네비게이션 (좁은 화면에서 자동으로 드롭다운 "더보기" 표시)
  - 오프스크린 측정 컨테이너로 정확한 너비 계산
  - 로고 + 네비게이션을 하나의 flex 그룹으로 묶어 우측 액션 영역과 명확히 분리
- **Footer** — 참고 링크 및 프로젝트 정보
- **Sidebar** — 대시보드 레이아웃용 (Route Group 데모)
- **ThemeProvider** — Context API 기반 테마 관리
- **ThemeToggle** — 테마 전환 버튼

### Shared 컴포넌트
- **RouteInfo** — 각 페이지 하단의 라우팅 패턴 설명 카드
- **CodeBlock** — 코드 스니펫 표시
- **ErrorBoundary** — 재사용 가능한 클래스 컴포넌트 기반 Error Boundary. `fallback` prop으로 에러 시 대체 UI 지정. `onError` 콜백으로 외부 관측 서비스 연동 가능

## 📁 디렉토리 구조

```
/app
├── globals.css              # TailwindCSS v4 + 테마 토큰
├── layout.tsx              # Root Layout
├── page.tsx                # 홈페이지
├── loading.tsx             # 루트 로딩 상태
├── error.tsx               # 에러 바운더리
├── not-found.tsx           # 404 페이지
├── proxy.ts                # 전역 프록시 (Next.js 16: middleware → proxy)
│
├── (marketing)/            # Route Group
│   ├── layout.tsx
│   ├── about/page.tsx
│   └── pricing/page.tsx
│
├── (dashboard)/            # Route Group (사이드바 레이아웃)
│   ├── layout.tsx
│   ├── dashboard/page.tsx
│   └── settings/page.tsx
│
├── blog/                   # 블로그
│   ├── page.tsx           # 목록
│   └── [slug]/            # 동적 세그먼트
│       ├── page.tsx
│       └── loading.tsx
│
├── shop/
│   └── [...categories]/   # Catch-all
│       └── page.tsx
│
├── docs/
│   └── [[...slug]]/       # Optional Catch-all
│       ├── page.tsx
│       └── DocsContent.tsx    # Client Component (사이드바 토글 상태 관리)
│
├── feed/                  # Parallel Routes
│   ├── layout.tsx
│   ├── page.tsx
│   ├── @feed/
│   │   ├── page.tsx
│   │   ├── default.tsx
│   │   └── error.tsx          # 슬롯 전용 에러 바운더리 (독립적 에러 처리 데모)
│   └── @stories/
│       ├── page.tsx
│       ├── default.tsx
│       └── loading.tsx        # 슬롯 전용 로딩 UI (3초 지연 데모)
│
├── gallery/               # Intercepting Routes 대상
│   ├── page.tsx
│   └── [id]/
│       └── page.tsx
│
├── @modal/                # Parallel Route (Intercepting용)
│   ├── default.tsx
│   └── (.)gallery/[id]/
│       └── page.tsx
│
├── api/                   # Route Handlers
│   ├── hello/route.ts
│   ├── revalidate/route.ts
│   ├── emp/route.ts           # Oracle DB scott.emp 조회 (GET)
│   ├── emp/[action]/route.ts  # Dynamic Segment: POST 방식 조회 (/search)
│   └── comp-search/           # CompSearch 전용 Route Handlers
│       ├── grid/route.ts      # 검색 결과 그리드 조회 (POST)
│       └── chart/route.ts     # 검색 결과 차트 집계 조회 (POST)
│
├── emp/                   # Oracle DB 연동 예제 페이지
│   └── page.tsx
│
├── tabs/                  # Tab/TabSub 컴포넌트 예제
│   ├── page.tsx           # 예제 인덱스 (/tabs)
│   ├── example-a/page.tsx # 클라이언트 상태 탭 (그리드 ↔ 차트 연동)
│   ├── example-b/page.tsx # searchParams 기반 탭 (URL 라우팅)
│   └── example-c/page.tsx # 크로스탭 통신 (장바구니 패턴)
│
├── search/                # Virtualization + Cascading Select 예제
│   └── page.tsx           # SearchPanel + 가상화 그리드 (/search)
│
├── comp-search/           # useTransition + Compound Component 예제
│   └── page.tsx           # CompGrid + CompChart 독립 병렬 조회 (/comp-search)
│
├── test-0409/             # TUI Grid + Function dataSource + Suspense 예제
│   ├── page.tsx           # SearchPanel + Grid 조회 (/test-0409)
│   └── _actions/
│       └── main.ts        # Server Actions (DNAME/JOB/ENAME cascade 옵션 + EMP 조회)
│
├── test-0419/             # Oracle Transaction (commit/rollback) 검증 예제
│   ├── page.tsx           # Commit/Rollback 버튼 + before/after SAL 비교 (/test-0419)
│   └── _actions/
│       └── main.ts        # fetchEmpSimple / runTxCommit / runTxRollback Server Actions
│
└── _components/           # Private Folder
    └── GalleryModal.tsx

/components
├── control/              # 재사용 UI 컨트롤
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Select.tsx
│   ├── Panel.tsx
│   ├── Badge.tsx
│   ├── Modal.tsx
│   ├── MultiSelect.tsx
│   ├── Tab.tsx
│   ├── TabSub.tsx
│   ├── SearchPanel.tsx
│   ├── CompGrid.tsx
│   ├── CompChart.tsx
│   ├── Grid.tsx
│   └── index.ts
├── layout/               # 레이아웃 컴포넌트
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── Sidebar.tsx
│   ├── ThemeProvider.tsx
│   └── ThemeToggle.tsx
└── shared/               # 페이지 간 공유
    ├── RouteInfo.tsx
    └── CodeBlock.tsx

/lib
├── utils.ts             # 공통 유틸리티
├── constants.ts         # 전역 상수 (네비게이션, 샘플 데이터)
├── hooks/
│   └── useDataSource.ts # 배열/Promise/함수형 dataSource 통합 처리 훅 (data/isLoading/error)
├── search-queries.ts    # CompSearch Route Handler 전용 DB 조회 모듈
├── utils/
│   ├── type/
│   │   └── index.ts     # 에러 프레임워크 핵심 타입: ActionError(plain), AppError(class), ActionResponse, ErrorType
│   ├── client/
│   │   ├── useAction.ts         # ActionResponse envelope 처리 훅. ActionError → AppError 복원
│   │   └── globalErrorHandler.ts # AppError/Error → Toast UI 출력 단일 진입점
│   └── server/
│       └── actionWrapper.ts     # actionAgent<T>(): Server Action → ActionResponse 래핑, 에러 → ActionError 변환
└── db/                  # Database 모듈 (팩토리 아키텍처)
    ├── index.ts         # public barrel: getDb / getDbClient(deprecated shim) / 타입 re-export
    ├── factory.ts       # getDb(name) 팩토리 — lifecycle(로그·에러변환)·캐싱·graceful drain (레지스트리 방식)
    ├── factory-new.ts   # getDb(name) 팩토리 — 환경변수 전용, 레지스트리·암호화 의존 없음
    ├── errors.ts        # DbError 표준 에러 클래스 + Oracle 에러 코드 → category 매핑
    ├── logger.ts        # 구조화 쿼리 로거 (JSON, SQL preview, 바인드 shape)
    ├── secret.ts        # AES-256-GCM connectString 암·복호화 헬퍼
    ├── types.ts         # IDbClient, BindParams, QueryOptions 등 공개 타입
    ├── config/
    │   ├── databases.ts # DB 레지스트리 (type-safe DbName literal union)
    │   └── flow.md      # DB 실행 흐름 다이어그램 문서
    ├── resolvers/
    │   └── env.ts       # 환경변수 DB_CONNECTION__<NAME> resolver (ADO.NET connectionString 파싱)
    └── providers/
        ├── index.ts     # 프로바이더 팩토리 및 closeAllProviders
        └── oracle.ts    # oracledb connection pool 기반 프로바이더 어댑터

/types
├── index.ts            # TypeScript 타입 정의
└── emp.ts              # Emp 인터페이스 (scott.emp 테이블)

/actions
├── posts.ts            # Server Actions (블로그 포스트)
├── emp.ts              # Server Actions (scott.emp 조회)
└── search.ts           # Server Actions (검색 데이터소스 및 결과 조회)
```

## 🚀 주요 기능

### Server Components 기본 사용
모든 컴포넌트는 기본적으로 Server Component로 작성되며, 인터랙션이 필요한 곳에만 `'use client'` 선언:
```tsx
// Server Component (기본값)
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  // 데이터 페칭, DB 접근 가능
}

// Client Component (필요할 때만)
'use client'
import { useState } from 'react'
export default function InteractiveComponent() { }
```

### Next.js 16 주요 변경사항 대응
- **params & searchParams는 Promise** — 반드시 `await` 필수
- **cookies()/headers()는 async** — `await` 후 사용
- **Route Handler GET은 dynamic** — 기본값으로 캐싱 안 됨
- **Type 헬퍼 활용** — `PageProps<'/route'>`, `LayoutProps<'/route'>` 글로벌 타입
- **middleware.ts → proxy.ts** — 함수명도 `middleware()` → `proxy()`로 변경, Node.js 런타임 전용

### Server Actions 패턴
```tsx
// actions/posts.ts
'use server'
export async function getPostBySlug(slug: string) {
  return SAMPLE_POSTS.find(p => p.slug === slug)
}

// 컴포넌트에서 호출
const post = await getPostBySlug(slug)
```

### Database Integration (Oracle)
```tsx
// getDb(name) 팩토리를 통해 DB 접근 (직접 provider 호출 금지)
import { getDb } from '@/lib/db'
import type { Emp } from '@/types/emp'

const db = getDb('MAIN')  // lib/db/config/databases.ts 에 등록된 이름
const emps = await db.query<Emp>(
  'SELECT * FROM scott.emp WHERE ENAME IN (:ename0, :ename1)',
  { ename0: 'SCOTT', ename1: 'KING' }
)
// getDbClient() 는 deprecated — 기존 코드 호환용으로만 유지
```

## 📚 학습 경로

1. **기초** — [홈](http://localhost:3000)에서 모든 패턴 네비게이션 확인
2. **Route Group** — [About](http://localhost:3000/about), [Pricing](http://localhost:3000/pricing), [Dashboard](http://localhost:3000/dashboard)
3. **동적 라우팅** — [Blog](http://localhost:3000/blog) → [포스트 상세](http://localhost:3000/blog/nextjs-app-router)
4. **다단계 경로** — [Shop](http://localhost:3000/shop/electronics/phones), [Docs](http://localhost:3000/docs/routing)
5. **병렬 라우팅** — [Feed](http://localhost:3000/feed) (피드 + 스토리 동시 렌더링)
6. **Intercepting** — [Gallery](http://localhost:3000/gallery) (Link 클릭 시 모달, 새로고침 시 전체 페이지)
7. **API** — [/api/hello](http://localhost:3000/api/hello) GET/POST 테스트
8. **Database** — [EMP 조회](http://localhost:3000/emp) (Oracle DB 연동: Server Action / GET Route Handler / POST Dynamic Segment Route Handler 세 가지 패턴 비교)
9. **Virtualization** — [Search](http://localhost:3000/search) (캐스케이딩 멀티셀렉트 + 가상화 그리드로 수만 건 데이터 처리)
10. **useTransition + Compound Component** — [CompSearch](http://localhost:3000/comp-search) (Grid/Chart 독립 병렬 조회, 내장 스켈레톤 자동 전환)
11. **TUI Grid + Function dataSource** — [test-0409](http://localhost:3000/test-0409) (cascade Select + `Grid` 컴포넌트, Promise dataSource + Suspense fallback)
12. **Oracle Transaction** — [test-0419](http://localhost:3000/test-0419) (`db.transaction()` 콜백 내 다중 UPDATE commit/rollback 원자성 검증)

## 🎓 각 페이지의 학습 포인트

모든 예제 페이지 하단에 **RouteInfo 컴포넌트**가 있어, 현재 페이지의:
- 라우팅 패턴 이름
- 파일 경로 (syntax)
- 상세 설명
- 공식 문서 링크

를 한눈에 확인할 수 있습니다.

## 🛠️ 개발 명령어

```bash
# 개발 서버 시작
pnpm dev

# 빌드
pnpm build

# 프로덕션 실행
pnpm start

# 린트
pnpm lint

# 타입 체크
pnpm type-check
```

## 🌐 테마 CSS 구조

`app/globals.css`에서 테마 토큰 정의:

```css
/* Light Theme */
:root {
  --color-bg-primary: #ffffff;
  --color-text-primary: #0f172a;
  /* ... */
}

/* Dark Theme */
.dark {
  --color-bg-primary: #0f172a;
  --color-text-primary: #f8fafc;
  /* ... */
}

/* TailwindCSS 등록 */
@theme inline {
  --color-bg-primary: var(--color-bg-primary);
  /* ... */
}
```

유틸리티 클래스로 사용:
```tsx
<div className="bg-bg-primary text-text-primary">
  라이트 모드: 흰 배경, 검은 텍스트
  다크 모드: 검은 배경, 흰 텍스트 (자동 적용)
</div>
```

## 📖 참고 자료

- [Next.js 16 공식 문서](https://nextjs.org/docs/app)
- [Routing Fundamentals](https://nextjs.org/docs/app/building-your-application/routing)
- [Dynamic Routes](https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes)
- [Parallel Routes](https://nextjs.org/docs/app/building-your-application/routing/parallel-routes)
- [Intercepting Routes](https://nextjs.org/docs/app/building-your-application/routing/intercepting-routes)
- [Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [TailwindCSS v4](https://tailwindcss.com/docs)
- [React 19](https://react.dev/blog/2024/12/05/react-19)

## 🎨 커스터마이징

프로젝트 구조와 컨벤션은 `CLAUDE.md`에 상세히 문서화되어 있습니다. 새로운 기능을 추가할 때 참고하세요.

---

이 프로젝트를 통해 Next.js 16의 모든 라우팅 패턴을 **직접 구현하고 동작을 관찰**하며 깊이 있게 학습할 수 있습니다.
