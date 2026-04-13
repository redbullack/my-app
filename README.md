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

### DB 연동
- **Oracle DB 통합** — scott.emp 테이블 조회 예제
  - `/emp` 페이지: MultiSelect 필터로 사원명 선택 및 조회 (Server Action / GET / POST 세 가지 방식 비교)
  - `/api/emp` Route Handler: WHERE IN 동적 쿼리 구성 (GET)
  - `/api/emp/[action]` Dynamic Segment Route Handler: Body로 enames 배열을 전달하는 POST 방식 조회 (`/api/emp/search`)
  - `lib/db/` 모듈: DB 팩토리 및 헬퍼 함수 (아래 상세 참고)

### DB 레이어 아키텍처 (`lib/db/`)
- **`getDb(name)` 팩토리** — `lib/db/factory.ts`. 레지스트리 조회 → DSN 복호화 → 프로바이더 선택 → lifecycle 래핑(로그·에러 변환)을 단일 진입점에서 처리. 인스턴스 캐싱으로 중복 풀 생성 방지
- **DB 레지스트리** — `lib/db/config/databases.ts`. C# DB.config XML 방식에서 영감을 받은 type-safe 레지스트리. `DbName` literal union으로 오타 시 컴파일 에러. `encrypt: true` 항목은 암호화된 ciphertext만 저장 가능
- **표준 에러** — `lib/db/errors.ts`. 모든 provider raw 에러를 `DbError`(category/code/traceId/cause)로 래핑하여 상위로 전파. `.message`는 항상 클라이언트 안전 문구, `cause`는 서버 로그 전용
- **Oracle 프로바이더** — `lib/db/providers/oracle.ts`. connection pool 기반 쿼리 실행, Oracle 에러 코드 → `DbErrorCategory` 자동 분류, `transaction()` 지원
- **구조화 로거** — `lib/db/logger.ts`. 쿼리 시작·완료·에러를 JSON 형태로 출력. 개발 환경에서 SQL preview(첫 120자) 및 바인드 파라미터 shape 노출
- **connectString 암호화** — `lib/db/secret.ts` + `scripts/db-encrypt.mjs`. AES-256-GCM 방식. `DB_CONFIG_SECRET` 환경변수(32 bytes hex) 로 암·복호화. `enc:v1:<iv>:<tag>:<cipher>` 포맷
- **하위 호환 shim** — `getDbClient()` deprecated 래퍼를 `lib/db/index.ts`에 유지하여 기존 호출부 무수정 마이그레이션 지원

### 클라이언트 에러 처리 아키텍처 (`lib/errors/`, `lib/hooks/`)

서버 측 `DbError` 패턴을 미러링한 클라이언트 전용 에러 분류·로깅·전파 시스템.

#### 에러 분류 — `lib/errors/client-errors.ts`

`ClientError` 클래스가 모든 클라이언트 에러를 6개 카테고리로 분류:

| 카테고리 | 용도 | 자동 분류 기준 |
|----------|------|----------------|
| `network` | fetch 실패, 오프라인, CORS, 5xx | `TypeError` (fetch), HTTP 500+ |
| `validation` | 폼/입력 유효성 검사 실패 | 수동 지정 |
| `render` | React 렌더링 에러 | 수동 지정 |
| `auth` | 401/403, 세션 만료 | HTTP 401/403 |
| `timeout` | AbortController 타임아웃 | `AbortError`, HTTP 408/504 |
| `unknown` | 기타 | 분류 불가 시 기본값 |

- `ClientError` 필드: `category`, `code?`, `traceId` (`crypto.randomUUID()`), `devMessage?`, `cause?`
- `.message`는 항상 사용자 안전 문구 (`SAFE_CLIENT_MESSAGE`), 실제 원인은 `devMessage`/`cause`에 보관
- `categorizeResponse(status)` — HTTP 상태코드 → 카테고리 자동 매핑
- `categorizeError(err)` — `TypeError`/`AbortError` 등 네이티브 에러 → 카테고리 추론

#### 구조화 로거 — `lib/errors/client-logger.ts`

서버 `DbLogger`와 동일 시그니처의 클라이언트 전용 로거:

- `ClientLogger` 인터페이스: `info(event, fields)`, `warn(event, fields)`, `error(event, fields)`
- `ConsoleClientLogger` 구현: JSON 한 줄 출력, `scope: 'client'` 고정
- `getClientLogger()` / `setClientLogger()` 싱글턴 패턴 — 향후 DB 저장 로거로 교체 가능

```
// 콘솔 출력 예시
{"scope":"client","level":"error","event":"client.error","category":"network","traceId":"a1b2c3d4-...","ts":"..."}
```

#### 에러 전파 전략 — 3가지 경로

React Error Boundary(`error.tsx`)는 **렌더링 중 에러만** 자동 캐치한다. 이벤트 핸들러/async 코드의 에러는 별도 전파가 필요:

| 에러 발생 위치 | error.tsx 도달 방법 | 파일 |
|----------------|---------------------|------|
| 렌더링 중 (`use()`, JSX) | **자동** — React Error Boundary가 캐치 | — |
| 이벤트 핸들러 / async | `useErrorHandler().throwError(err)` | `lib/hooks/useErrorHandler.ts` |
| window 전역 미처리 | **로깅만** (Error Boundary 도달 불가) | `components/providers/GlobalErrorCatcher.tsx` |

**`useErrorHandler` 훅** (`lib/hooks/useErrorHandler.ts`):
- `setState(() => { throw err })` 패턴으로 비-렌더링 코드의 에러를 가장 가까운 Error Boundary로 전파
- 에러를 `ClientError`로 래핑 + `getClientLogger().error()` 호출 후 rethrow
- 사용법:
  ```tsx
  const { throwError } = useErrorHandler()
  async function handleClick() {
    try { await fetchSomething() }
    catch (err) { throwError(err) }  // → error.tsx로 전파
  }
  ```

**`GlobalErrorCatcher`** (`components/providers/GlobalErrorCatcher.tsx`):
- `window.addEventListener('error')` + `'unhandledrejection'` 리스너 등록
- Error Boundary로 전파 불가하므로 **로깅 전용**
- `app/layout.tsx`의 `<AuthSessionProvider>` 안쪽에 배치

#### `useErrorHandler` 활용 시나리오

| 시나리오 | 코드 패턴 |
|----------|-----------|
| fetch 실패 | `try { await fetch(...) } catch (err) { throwError(err) }` → `network` 카테고리 자동 분류 |
| 폼 유효성 검사 | `throwError(new ClientError({ category: 'validation', devMessage: '...' }))` |
| 타임아웃 | `AbortController` + `throwError(err)` → `timeout` 카테고리 자동 분류 |
| Server Action 실패 | `try { await serverAction() } catch (err) { throwError(err) }` → `unknown` (서버 에러 직렬화로 원본 타입 소실) |
| 401/403 응답 | `if (!res.ok) throwError(new ClientError({ category: categorizeResponse(res.status) }))` |
| 조건부 에러 | `if (data.length === 0) throwError(new ClientError({ category: 'validation', devMessage: '결과 없음' }))` |

#### Server Action과 DbError의 직렬화 제한

Server Action에서 throw된 `DbError`는 서버→클라이언트 직렬화 과정에서 **커스텀 필드가 소실**된다:
- 서버: `DbError { category: 'connection', traceId: 'abc-123', code: 'ORA-12541' }`
- 클라이언트 수신: `Error { message: '처리할 수 없는 요청입니다', digest: '...' }` (일반 Error로 변환)

따라서 클라이언트에서는 서버 에러의 세부 카테고리를 알 수 없으며, `useErrorHandler`가 `unknown`으로 분류한다. 서버 에러의 상세 분류/traceId는 **서버 측 `DbLogger`에서만** 확인 가능하다.

#### React 19 `use()` 훅과 에러 전파

`use()` 훅으로 Promise를 unwrap하면 **렌더링 단계에서** reject가 발생하므로, Error Boundary가 자동으로 캐치한다:

```tsx
// Server Component에서 Promise를 prop으로 전달
const dataPromise = fetchData()  // Promise<Data>
<ClientComponent dataPromise={dataPromise} />

// Client Component에서 use()로 unwrap
const data = use(dataPromise)  // reject 시 → 렌더링 에러 → error.tsx 자동 전파
```

이 경우 `useErrorHandler`가 필요 없다. `use()`의 reject는 렌더링 중 throw이므로 React가 자동 처리한다.

#### error.tsx의 ClientError 인식

`app/error.tsx`가 `ClientError`를 감지하면 추가 정보를 표시:
- `category` Badge (예: `network`, `auth`)
- `traceId` 앞 8자리 (디버깅용)
- `getClientLogger().error()` 호출로 구조화 로그 출력

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
└── db/                  # Database 모듈 (팩토리 아키텍처)
    ├── index.ts         # public barrel: getDb / getDbClient(deprecated shim) / 타입 re-export
    ├── factory.ts       # getDb(name) 팩토리 — lifecycle(로그·에러변환)·캐싱·graceful drain
    ├── errors.ts        # DbError 표준 에러 클래스 + Oracle 에러 코드 → category 매핑
    ├── logger.ts        # 구조화 쿼리 로거 (JSON, SQL preview, 바인드 shape)
    ├── secret.ts        # AES-256-GCM connectString 암·복호화 헬퍼
    ├── types.ts         # IDbClient, BindParams, QueryOptions 등 공개 타입
    ├── config/
    │   └── databases.ts # DB 레지스트리 (type-safe DbName literal union)
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
