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
  - `lib/db/factory.ts`의 ALS 기반 `db.tx(async () => ...)` 동작을 실제로 검증하는 테스트 라우트
  - **Commit 테스트** — 두 건의 `SCOTT.EMP.SAL`을 `+delta`만큼 증감하는 UPDATE 두 개를 단일 트랜잭션 콜백에서 실행, 정상 종료 시 두 건 모두 반영되는지 before/after SAL 비교
  - **Rollback 테스트** — 동일한 두 건 UPDATE 실행 후 콜백 내부에서 `__forced_rollback__` 에러를 고의로 throw → 두 건 모두 원복되는지 확인. sentinel 에러 메시지만 catch 처리하여 삼킴 처리, 그 외 에러는 재전파
  - `runTxCommit` Server Action이 `db.tx(async () => ...)` 콜백 내에서 같은 `db` 객체로 `db.query` / `db.execute`를 호출 — ALS 컨텍스트를 통해 자동으로 동일 커넥션 위에서 수행
  - `readSal(empno)` 헬퍼가 트랜잭션 안/밖에서 **동일한 시그니처**로 재사용됨 (`ITxClient` 인자 전달 불필요)
  - `TxTestResult` 타입(`committed`, `beforeA/B`, `afterA/B`)을 Panel에 표 형태로 노출하여 커밋/롤백 전후 값을 시각적으로 비교
  - **Rollback 버튼 임시 비활성화** — `runTxRollback` Server Action 및 `/test-0419` 페이지의 Rollback 버튼/핸들러를 주석 처리하여 현재는 Commit 테스트만 수행. 롤백 검증 로직은 주석으로 보존되어 추후 재활성화 가능
  - **`QueryResult` 도메인 통일** — `fetchEmpSimple` Server Action이 `result.rows`만 풀어 반환하던 방식에서 `QueryResult<T>`(`{ columns, rows }`) 전체를 반환하도록 변경. 페이지 상태(`useState`) 타입도 `QueryResult<EmpSimpleRow>` 기반으로 정렬하여 Grid의 신규 DataSource 도메인과 호환
- **Cascade Select + Function dataSource (Suspense)** — `/test-0512` 페이지 신규 추가
  - SCOTT.EMP 조회 화면. JOB(필수) → EMPNO / ENAME 으로 cascade되는 멀티 Select + Grid 조합
  - 모든 `dataSource`(Input/Grid)를 **함수 형태**로 전달 — `useCallback`/`useMemo`로 `fetchXxx.bind(null, cond.job)` 패턴 적용
  - 조회 버튼 클릭 시 현재 검색 조건을 `bind`하여 `useState`에 보관 → Grid가 Suspense로 fetch
  - Grid columns를 별도로 정의하지 않고 `QueryResult.columns` **메타로 자동 추론** (빈 결과셋에서도 헤더 보존)
  - JOB 미선택 시 토스트 경고로 가드

### DB 레이어 대폭 단순화 (2026-05)
"기본 기능에 충실" 원칙으로 DB layer 의 over-engineering 을 걷어냄. 운영 환경의 핵심 책임 — **쿼리 실행 + 이력 로깅** — 외 보조 기능은 제거하거나 호출 지점 인라인으로 대체.

- **`DbError` 클래스 + provider 별 `categorize*Error` 매핑 폐기** — `lib/db/errors.ts` 파일 삭제. provider 의 `toDbError` 래퍼도 제거하여 raw 드라이버 에러가 그대로 위로 전파됨. 카테고리 분류 대신 **`util.inspect(err, { depth: null, breakLength: Infinity, maxStringLength: Infinity })`** 로 에러 전체(message/stack/driver code/cause 체인) 를 한 줄 텍스트로 직렬화하여 운영 DB 의 `ERROR_DESC` CLOB 컬럼에 그대로 적재. 클라이언트에는 마스킹된 일반 메시지만 노출하면 충분하다는 PM 가치관 반영
- **`withLifecycle` 고차함수 제거** — factory.ts 의 query/execute/transaction 본문에 try/catch + 로깅을 인라인. 호출부의 흐름(start 측정 → provider 호출 → 로깅 → return) 이 한눈에 보임. 공통 필드 조립만 `logDb()` 데이터 빌더 1개로 추출
- **`getSysDb` / `ISysDbClient` 삭제, `getDb` 단일 진입점화** — `getRequestCtx()` 를 throw 안 하는 best-effort 로 변경하여 세션 없는 컨텍스트(next-auth `authorize` 콜백 등) 도 일반 `getDb` 를 그대로 사용 가능. 로그인 도중 쿼리는 사용자 필드가 빈 채로 정상 로깅됨 (의미상 정확)
- **3-tier traceId 폐기** — `traceId` / `parentTraceId` / `actionTraceId` 모델 제거. 분산 추적이 실제로 필요해질 때 다시 도입. ALS 기반 액션 단위 traceId 묶음도 제거
- **`TxState` 안전망 제거** — `inflight` / `closing` / `aborted` / `destroy` 분기 폐기. `await` 누락 같은 개발자 실수는 ESLint + 코드 리뷰 책임. 구조적 보호(중첩 transaction, 교차 DB 호출 차단) 만 유지
- **`IDbClient.tx` → `transaction` 으로 메서드 명 확장** — 줄임말 회피
- **`QueryOptions` 공개 필드 제거** — `maxRows` / `timeoutMs` 폐기. 행 수 제한은 SQL 의 `LIMIT`/`ROWNUM`, 타임아웃은 세션 설정으로 대체. `IDbClient.query/execute` 시그니처에서 `opts` 인자 자체 삭제. provider 가 받는 `QueryOptions` 는 `traceId`/`conn` 내부 필드만 보유
- **`IDbProvider.destroy` 훅 제거** — 안전망 폐기와 함께 dead. 3개 provider 의 `destroy` 구현도 삭제
- **`actionWrapper.ts` / `userConcurrency.ts` 활용 중단** — Server Action 단위 동시성 게이트와 envelope 변환 폐기. ServerAction 은 raw 결과를 그대로 반환

### DB 로거 함수형 재작성 (2026-05)
`lib/db/logger.ts` 의 책임을 **운영 로그 테이블 INSERT 1건** 으로 축소. 클래스/인터페이스 기반 dispatch 구조를 함수 1개로 단순화.

- **`DbLogger` interface / `ConsoleDbLogger` 클래스 / `getDbLogger` / `setDbLogger` 전부 삭제** — public API 는 `insertLogQuery(fields)` 함수 하나
- **STATUS 자동 분기** — `errorDesc` 유무로 `'OK'` / `'FAIL'` 결정. 호출자는 outcome 별 분기 없이 같은 필드 셋만 넘기면 됨
- **재귀 가드 = AsyncLocalStorage 1개** — `loggingScope.run(true, ...)` 으로 INSERT 자체를 감싸고, factory 의 `logDb` 진입부에서 `loggingScope.getStore()` 가 truthy 면 즉시 return. SQL 패턴 매칭이나 별도 우회 경로 없이 정확히 한 단계에서만 차단. 재귀 케이스에서는 `getRequestCtx()` 호출도 skip 되어 추가 비용 0
- **fire-and-forget 시그니처** — 호출자는 `void insertLogQuery({...})` 로 호출. await 강제 안 함 → 응답 시간에 INSERT 시간 포함 안 됨

### `requestContext.ts` ALS 폐기 (2026-05)
- `runWithRequestContext` / `getRequestContext` ALS 모델 폐기. `getRequestCtx()` 단순 async 함수로 변경
- 모든 필드를 optional 로 선언 (`Partial<>` 대신) — 호출부 시그니처가 한 단어로 끝남
- **절대 throw 하지 않음** — auth 인프라 부재/세션 없음 모두 silent 처리. auth.ts authorize 콜백처럼 "로그인 도중" 경로에서도 안전하게 호출 가능

### Grid `QueryResult` 도메인 전환
- **`Grid` DataSource 타입을 `T[]` → `QueryResult<T>`로 특수화** — Server Action이 `db.query(...)` 결과(`{ columns, rows }`)를 그대로 반환하면 Grid가 흡수
  - `deriveColumns()`가 **1순위로 `QueryResult.columns` 메타**를 사용하여 빈 결과셋에서도 컬럼 헤더를 보존 (메타 컬럼의 `type`에 따라 `align`을 `right`/`center`/`left`로 자동 결정), 2순위로 첫 행 키 기반 추론
  - **함수형 dataSource Promise 캐시** — 모듈 스코프 `WeakMap` 기반 `getCachedResource()`로 같은 함수 참조에 동일 Promise를 반환. 첫 마운트 suspend 시 `useRef`가 폐기되어 발생하던 무한 재호출을 차단하며, 함수 GC 시 캐시도 자동 해제

### Input `dataSource` 처리 통일
- **`Input` envelope 언래핑을 `resolveDataSource`로 위임** — 자체 `isActionResponse`/`unwrapSelectSource` 헬퍼를 제거하고 `resolveDataSource`(전역 에러 핸들러 통합)로 일원화. 실패 시 전역 토스트 + throw → catch로 빈 옵션 폴백

### DB 로깅 타임존
- **`lib/db/factory.ts` 로그 타임스탬프 KST(+09:00) 적용** — `Date#toISOString()`이 항상 UTC(Z)를 반환하여 한국 시간과 9시간 차이가 나 가독성이 떨어지던 문제를 해결. `dayjs` + `utc` 플러그인으로 고정 오프셋 `+09:00` ISO 문자열을 출력하는 `kstIso()` 헬퍼 도입 (외부 라이브러리 최소화 원칙상 예외 허용된 `dayjs`만 사용)

### DB 연동
- **Oracle DB 통합** — scott.emp 테이블 조회 예제
  - `/emp` 페이지: MultiSelect 필터로 사원명 선택 및 조회 (Server Action / GET / POST 세 가지 방식 비교)
  - `/api/emp` Route Handler: WHERE IN 동적 쿼리 구성 (GET)
  - `/api/emp/[action]` Dynamic Segment Route Handler: Body로 enames 배열을 전달하는 POST 방식 조회 (`/api/emp/search`)
  - `lib/db/` 모듈: DB 팩토리 및 헬퍼 함수 (아래 상세 참고)

### DB 레이어 아키텍처 (`lib/db/`)
- **`getDb(name)` 팩토리 (환경변수 방식, 단일화)** — `lib/db/factory.ts`. `.env.local`의 `DB_CONNECTION__<NAME>` 환경변수에서 접속 정보를 해석하는 단일 팩토리. 기존 `factory-new.ts`(환경변수 방식)의 로직을 `factory.ts`로 통합하고 `factory-new.ts`를 삭제. 레지스트리·`secret.ts` 암호화 의존 없이 lifecycle 래핑(로깅·에러 변환·캐싱·종료 훅) 제공. ADO.NET 스타일 connectionString(`User ID=...;Password=...;Data Source=...;Min Pool Size=...`) 파싱 지원
- **환경변수 Resolver** — `lib/db/resolvers/env.ts`. `DB_CONNECTION__<NAME>` 환경변수의 JSON 값에서 `providerName`과 ADO.NET 스타일 `connectionString`을 파싱하여 `ResolvedDsn` + `PoolOptions` 반환. `User ID`, `Password`, `Data Source`, `Min Pool Size`, `Max Pool Size`, `Pool Increment` 키 지원
- **DB 실행 흐름 문서** — `lib/db/config/flow.md`. `getDb()` → `resolveFromEnv()` → `provider.query()` → `withLifecycle()` 로깅까지의 전체 실행 흐름을 다이어그램으로 문서화
- **DB 레지스트리** — `lib/db/config/databases.ts`. `DbConfigEntry` 인터페이스를 `lib/db/types.ts`에서 이 파일로 이동. `DbName` literal union으로 타입 안전성 유지. `encrypt: true` 항목은 암호화된 ciphertext만 저장 가능
- **표준 에러** — `lib/db/errors.ts`. 모든 provider raw 에러를 `DbError`(category/code/traceId/cause)로 래핑하여 상위로 전파. `.message`는 항상 클라이언트 안전 문구, `cause`는 서버 로그 전용
- **Oracle 프로바이더** — `lib/db/providers/oracle.ts`. connection pool 기반 쿼리 실행, Oracle 에러 코드 → `DbErrorCategory` 자동 분류. `acquireTxConnection` / `commit` / `rollback` / `release` 4개의 저수준 커넥션 라이프사이클 훅으로 트랜잭션 관리 책임을 factory로 이관
- **구조화 로거** — `lib/db/logger.ts`. 쿼리 시작·완료·에러를 JSON 형태로 출력. 운영 전환 시점에 `setDbLogger()`로 Oracle 로그 테이블 insert 구현체 등으로 교체 가능 (단, `getDb()` / `withLifecycle` 경유 금지로 무한 재귀 방지)
- **connectString 암호화** — `lib/db/secret.ts` + `scripts/db-encrypt.mjs`. AES-256-GCM 방식. `DB_CONFIG_SECRET` 환경변수(32 bytes hex) 로 암·복호화. `enc:v1:<iv>:<tag>:<cipher>` 포맷
- **하위 호환 shim** — `getDbClient()` deprecated 래퍼를 `lib/db/index.ts`에 유지하여 기존 호출부 무수정 마이그레이션 지원
- **`db.query()` 반환 타입 변경 — `QueryResult<T>`** — `T[]` 대신 `{ columns, rows }` 구조의 `QueryResult<T>`를 반환하도록 `IDbClient` / `IDbProvider` 시그니처를 변경. `columns`는 `{ name, type: 'string' | 'number' | 'date' }[]` 형태의 컬럼 메타데이터로, Oracle `dbTypeName`(`NUMBER`/`DATE`/`TIMESTAMP*`/`VARCHAR2` 등)을 통합 타입으로 매핑하여 제공. 클라이언트에서 동적 그리드 컬럼 구성·타입 기반 포매팅 등에 활용 가능. `tx.query()`(트랜잭션 내부)도 동일한 구조로 반환. 호출부는 `const { rows } = await db.query(...)` 패턴으로 분해 사용
- **ALS 기반 암묵적 트랜잭션 (`db.tx()`)** — `transaction(async tx => ...)` 콜백 패턴과 `ITxClient` 타입을 제거하고, `AsyncLocalStorage` 기반의 `db.tx(async () => ...)` 방식으로 교체. 트랜잭션 콜백이 인자를 받지 않으며, 내부에서 같은 `db` 객체의 `query/execute`를 그대로 호출하면 ALS 컨텍스트를 통해 자동으로 동일 커넥션을 공유한다. 핵심 변경 사항:
  - `IDbClient`에 `tx<R>(fn: () => Promise<R>)` 추가, `transaction` / `ITxClient` 제거
  - `factory.ts` 모듈 스코프에 `txStore = AsyncLocalStorage<Map<dbName, TxState>>` 추가, `makeClient` 헬퍼 제거 — `getDb` 내부에서 직접 `IDbClient` 구성
  - `parentTraceId`가 ALS에서 자동 조회되어 수동 전파 불필요
  - `IDbProvider`의 `withTransaction(fn)` 콜백 방식을 `acquireTxConnection` / `commit` / `rollback` / `release` 4 훅으로 교체 — provider는 커넥션 라이프사이클만 책임, ALS 운영은 factory가 전담
  - 동일 DB 중첩 `tx()` 런타임 차단, `inflight` 카운터로 `await` 누락(`forEach(async)`) 자동 감지 후 rollback
  - **`TxState.aborted` 플래그** — 중첩 `tx()` 감지 시 자식이 throw하기 직전에 부모 `TxState.aborted = true`를 세팅. 호출자가 자식 throw를 `try/catch`로 삼켜도 부모 tx 종료 시점에 `aborted` 를 검사하여 commit 대신 강제 rollback으로 분기. `query/execute` 진입부에서도 `aborted` 상태를 검사하여 후속 쿼리를 즉시 차단(fail-fast). `closing`은 commit/rollback 진행 중 의미로 유지하고 `aborted`와 분리하여 혼용 방지
  - 헬퍼 함수 시그니처에서 `client: ITxClient` 인자가 사라져 트랜잭션 안/밖에서 동일 함수 무수정 재사용 가능
  - 다중 DB 트랜잭션(`main.tx` 안에서 `audit.tx`)은 독립적으로 commit/rollback 가능
- **tx 안전망 발동 시 connection 폐기 (`provider.destroy`)** — fire-and-forget(`void db.execute(...)` / `forEach(async)`) 등으로 tx 콜백이 끝난 뒤에도 in-flight 쿼리가 남아있는 경우, `release(conn)`로 풀에 반납하면 진행 중이던 driver 호출이 다음 사용자의 conn 위에서 실행되는 cross-request 누수가 발생할 수 있다. 이를 구조적으로 차단하기 위해:
  - **`IDbProvider.destroy(conn)` 추가** — 풀로 반납하지 않고 conn 자체를 폐기. Oracle 구현은 `connection.close({ drop: true })` 로 풀에서 빼낸 뒤 닫는다. 풀은 새 conn 을 만들어 자리를 채움
  - **`TxState.inflight` 를 `Set<Promise>` 로 변경** — 카운터가 아닌 promise 집합으로 추적하여, 안전망 발동 시 unhandled rejection 차단을 위한 noop catch 부착이 가능
  - **`dirty` 분기로 release/destroy 라우팅** — `state.aborted` 또는 `state.inflight.size > 0` 이면 conn 을 풀에 반납하지 않고 `destroy`. 정상 비즈니스 실패(in-flight 0)는 기존대로 `rollback` → `release` 로 풀 반납하므로 운영 환경 풀 회전 비용은 그대로 유지
  - **dirty 분기에서 rollback 생략** — in-flight 와 같은 conn 위에서 rollback 이 동시에 실행되면 driver 가 꼬일 수 있고, 이어지는 destroy 가 트랜잭션을 폐기하므로 데이터 정합성은 보장됨
  - **`lib/db/config/flow.md` 문서화** — 최상단에 `TxState` 속성 역할 정리(6개 속성의 책임/사용지점) 와 드라이버별 conn 폐기 가능성(oracle/pg/mysql2/mariadb/mssql/db2/odbc 의 destroy/cancel API 와 난이도 ★ 표기) 섹션 추가
- **트랜잭션 로그 상관관계(parentTraceId)** — `factory.ts`의 `withLifecycle`이 자체 `txTraceId`를 발급하고, 내부 `query` / `execute` 호출 시 ALS에서 `parentTraceId`를 자동 조회하여 로그에 기록. 트랜잭션 블록 안에서 실행된 여러 쿼리를 하나의 트랜잭션으로 묶어 추적 가능. `parentTraceId`는 호출자가 직접 지정하지 않으며 factory 내부에서만 관리된다
- **DB 로그 시점 왜곡 방지 (`startedAt` / `endedAt`)** — `withLifecycle` 의 모든 `db.ok` / `db.err` 페이로드에 호출 시점에 미리 계산한 `startedAt` / `endedAt` (ISO 문자열) 을 추가. 비동기 INSERT 기반 `OracleDbLogger` 로 전환 시 큐 지연으로 `SYSDATE` 가 뒤로 밀려 찍히는 시각 왜곡을 차단하기 위함. `ConsoleDbLogger.write` 가 자동으로 박던 `ts` 키는 `loggedAt` 으로 의미를 분리하여 "로그 emit 시각" 과 "쿼리 실행 시각" 을 구분. `durationMs` 는 편의 필드로 유지
- **운영용 DB 로그 INSERT 전환 가이드** — `lib/db/config/flow.md` 최상단에 `ConsoleDbLogger` → 운영 INSERT 구현체 교체 시 검토 포인트를 정리. 무한 재귀 차단(`getDb`/`withLifecycle` 미경유, logger 전용 풀, `inLogger` ALS 가드), 동기 시그니처 위 비동기 INSERT 의 로그 손실/순서 역전/백프레셔 대응(`flush(): Promise<void>` + 종료 훅 await + 배치 INSERT + drop policy), 실패 격리(회로차단기·degraded mode), 민감정보(영구 저장 시 보안 등급 상승, 마스킹·`bindShape`·retention/파티셔닝), 하이브리드 컬럼 스키마(인덱싱 핵심 필드만 컬럼 + 나머지 CLOB JSON), 트랜잭션 의미(별도 conn + `autoCommit: true` 4가지 동시 성립 조건), `startedAt`/`endedAt` 분리 로깅의 OracleDbLogger 적용 가이드, `DbLogger` 인터페이스의 다른 도메인 재사용성(`ScopedLogger`/`flush`/level/Error 1급 보존 개선 방향) 8개 섹션 수록
- **3-tier traceId 모델 (`traceId` / `parentTraceId` / `actionTraceId`)** — OpenTelemetry 의 `trace_id` / `parent_span_id` / `span_id` 와 동일한 계층화. `withLifecycle` 의 모든 `db.ok` / `db.err` 로그에 세 필드를 함께 기록한다. `traceId` 는 본 호출(query/execute/tx) 자체의 식별자, `parentTraceId` 는 직속 부모(동일 DB 의 tx 안에서만 set, 그 외 undefined), `actionTraceId` 는 요청 루트(액션) 식별자. 이전에 `parentTraceId` 한 필드가 상황에 따라 "tx" 또는 "액션" 두 가지를 가리키던 오버로딩을 해소하여, 향후 로그 테이블 적재 시 `actionTraceId` 인덱스 한 방으로 액션 단위 전체 이력을 조회할 수 있다. `actionAgent` 의 `action.error` 콘솔 로그도 필드명을 `actionTraceId` 로 통일. 클라이언트 envelope 의 `ActionError.traceId` 는 액션 traceId 의미로 그대로 유지(외부 계약 불변)
- **`QueryOptions` 공개/내부 분리** — 호출자(서버 액션·라우트 핸들러)에게 노출되는 `QueryOptions`는 `maxRows` / `timeoutMs` 두 필드만 가진다. `traceId` / `parentTraceId` / `conn` 같은 내부 메타는 `InternalQueryOptions`(extends QueryOptions)로 분리하여 factory ↔ provider 경계에서만 사용. `IDbClient`의 `query/execute` 시그니처는 `QueryOptions`(공개)를 받고, `IDbProvider`의 시그니처는 `InternalQueryOptions`(내부)를 받도록 타입 경계를 명확히 구분. `traceId`는 항상 factory에서 `randomUUID()`로 자동 발급되며 호출자 주입 경로가 없다
- **요청 컨텍스트(AsyncLocalStorage) 기반 로그 상관관계** — `lib/utils/server/requestContext.ts` 신규 추가. Node.js `AsyncLocalStorage`로 Server Action 요청 스코프를 구성하여 `traceId` / `userId` / `userName` / `role` / `empno` / `actionName` / `pagePath` / `loggable`을 저장. `actionAgent` 진입 시 `auth()` 세션과 `headers()`의 referer를 읽어 1회 세팅하고, 하위 `getDb` / `withLifecycle` / 로거가 파라미터 전달 없이 동일 컨텍스트를 읽어 모든 `db.ok` / `db.err` 로그에 세션·페이지·액션 필드를 자동 부착. 액션 단위 `traceId`가 DB lifecycle의 `parentTraceId`로 자동 연결되어 하나의 요청 안에서 실행된 모든 쿼리/에러 로그가 동일 `traceId`로 묶임. `unknown` 에러 fallback에서도 새 traceId를 생성하지 않고 ALS값을 재사용. `lib/utils/server/index.ts` barrel에서 `runWithRequestContext` / `getRequestContext` / `RequestContext` 타입 export
- **로그 opt-in(`loggable` 플래그)** — 요청 컨텍스트의 `loggable: true`가 세팅된 사용자 유발 진입점(현재는 `actionAgent`)에서만 DB lifecycle 로그를 남긴다. NextAuth 세션 조회·`warmupDb` 등 프레임워크 내부에서 발생하는 쿼리는 컨텍스트가 없거나 `loggable`이 없어 자동으로 로그에서 제외되어 운영 로그 노이즈를 제거. 트랜잭션 단위 실패는 하위 쿼리에서 이미 로깅되었더라도 `op: 'transaction'` 요약 1줄을 추가로 기록하여 트랜잭션 단위 집계가 가능
- **DbError 중복 로깅 방지** — `withLifecycle`의 catch 경로에서 이미 로깅된 `DbError`에 `__loggedByLifecycle` 플래그를 찍어, 상위 스코프(예: transaction wrapper)에서 동일 에러를 재포착해도 `db.err` 로그가 중복 출력되지 않도록 보정
- **Oracle Thick 모드 초기화** — `lib/db/providers/oracle.ts`의 `ensureThickMode()`가 첫 풀 생성 시 1회 수행. `vendor/instantclient/instantclient_21_20` 경로의 Oracle Instant Client를 `oracledb.initOracleClient({ libDir })`로 로드하고, `globalThis` 플래그(`__myapp_oracle_thick_initialized__`)로 중복 초기화를 방지. 실패 시 `DbError(category: 'config')`로 래핑하여 원인(libDir 경로·설치 여부)을 devMessage에 포함. Instant Client 폴더는 `.gitignore`에 추가되어 저장소에서 제외
- **DB 풀 워밍업(`warmupDb`)** — `factory.ts`에서 `warmupDb(name)` 함수 export. `lib/db` barrel을 통해 접근(`import { warmupDb } from '@/lib/db'`). 환경변수 resolver로 DSN/풀 옵션을 해석한 뒤 `provider.warmup()`을 호출하여 풀을 선제 생성. 이미 생성된 풀은 provider 캐시가 no-op 처리
- **`lib/db/index.ts` public barrel 정비** — `getDb`·`warmupDb`·`DbError`·타입들을 단일 진입점으로 re-export. `DbName` 타입 및 레지스트리 의존 제거. 외부 코드는 `lib/db/*` 하위 경로 직접 import 금지
- **DB 레이어 캡슐 가드 (encapsulation guards)** — DB 모듈을 외부에서 우회 접근하지 못하도록 다층 가드를 추가
  - **ESLint deep-import 차단** — `eslint.config.mjs` 에 `no-restricted-imports` 규칙 추가. `@/lib/db/*` deep import 와 `oracledb` 네이티브 드라이버 직접 import 를 모두 에러로 차단하고, 외부는 반드시 `@/lib/db` public barrel 만 사용하도록 강제. `lib/db/**` 내부와 `instrumentation-node.ts`(부팅 훅의 `warmupDb` deep import 용) 는 명시적 면제
  - **`warmupDb` public barrel 제외** — 부팅 전용 함수이므로 `@/lib/db` 에서 export 하지 않고, `instrumentation-node.ts` 만 `@/lib/db/factory` 에서 직접 import
  - **옵션 화이트리스트 strip (`pickPublicOpts`)** — `factory.ts` 의 `query`/`execute` 진입 시 caller 가 넘긴 옵션에서 `maxRows`/`timeoutMs` 만 남기고 `conn`/`traceId`/`parentTraceId` 같은 internal 메타를 제거. 외부 코드가 `as any` 우회로 raw 커넥션을 주입해 트랜잭션 컨텍스트를 탈취하는 것을 런타임에서 차단
  - **DB 이름 화이트리스트(`assertValidDbName`)** — `getDb(name)` / `warmupDb(name)` 진입 시 `^[A-Z][A-Z0-9_]{0,63}$` 정규식으로 이름 형식 검증. 외부 입력이 흘러들어와 임의 환경변수(`DB_CONNECTION__<NAME>`) 의 존재를 prove 하는 표면을 차단
  - **`clientCache` HMR-safe 화** — 모듈 스코프 `Map` 대신 `getClientCache()` 헬퍼로 `globalThis.__myapp_db_client_cache__` 에 보관(oracle 풀 캐시와 동일 패턴). dev HMR 환경에서 factory 모듈이 재평가되어도 동일 클라이언트 인스턴스를 재사용하여 일관성 유지
  - **다중 DB tx 한계 명시** — `tx()` JSDoc 에 분산 트랜잭션(XA) 이 아니라는 ⚠️ 경고를 추가. 자식 tx commit 후 부모 tx rollback 시 자식 변경은 보존됨을 명시
- **`lib/auth/auth.ts` QueryResult 마이그레이션** — next-auth Credentials `authorize()`에서 deprecated `getDbClient()` 대신 `getDb('MAIN')`을 사용하고, `db.query<Emp>(...)` 결과를 `const result = ...` → `result.rows`로 분해하여 `QueryResult<T>` 구조에 맞게 업데이트

### 유틸리티 레이어 구조 개편 (`lib/utils/`)

- **`lib/utils/index.ts` (public barrel)** — 클라이언트·공용 심볼을 단일 진입점으로 export. `cn`, `delay`, `formatDate`(공통 유틸), `AppError`, `ActionResponse`, `ActionError`, `ErrorType`(에러 타입)을 `@/lib/utils`에서 한 번에 import 가능
- **`lib/utils/common.ts`** — 기존 `lib/utils.ts`에서 rename. `cn`, `delay`, `formatDate` 등 순수 유틸리티 함수 보관
- **`lib/utils/type.ts`** — 기존 `lib/utils/type/index.ts`에서 단일 파일로 flatten. 에러 프레임워크 핵심 타입 정의
- **`lib/utils/client/index.ts` (client barrel)** — `useAction`, `handleGlobalError` export. Client Component에서 사용
- **`lib/utils/server/index.ts` (server barrel)** — `actionAgent` export. Server Action 파일에서만 import (`'use server'` 경계 준수)
- **import 경로 통합** — `@/lib/utils/type`, `@/lib/db/errors` 등의 내부 경로 직접 import를 각각 `@/lib/utils`, `@/lib/db` barrel import로 일원화. `app/error.tsx`, `app/test-case/error.tsx`, `components/control/Grid.tsx`, `components/control/Input.tsx`, `lib/utils/server/actionWrapper.ts`, `instrumentation-node.ts` 등 영향 파일 일괄 수정

### 클라이언트 에러 처리 아키텍처 (`lib/utils/type`, `lib/utils/client/`)

Server Action → Client 사이의 에러를 직렬화 경계를 고려하여 `ActionError`(plain object)와 `AppError`(class) 두 계층으로 분리한 에러 프레임워크.

#### 타입 계층 — `lib/utils/type.ts`

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

### Instrumentation 활성화 (서버 부팅 훅)

- **`instrumentation.ts`** — Next.js `register()` 엔트리. Node/Edge 양쪽 런타임으로 번들링되므로 **런타임 체크 후 동적 import**만 수행하여 Edge 번들에 Node 전용 API가 섞이지 않도록 분리
- **`instrumentation-node.ts`** — Node 전용 로직. 서버 부팅 시 `server.start` 로그 출력 후, `criticalDbs`(현재 `['MAIN']`)에 대해 `warmupDb()`를 병렬 호출하여 DB 풀을 선제 생성. 성공 시 `db.pool.ready` / `server.ready` JSON 로그 기록, 실패 시 `server.boot.failed` 로깅 후 `process.exit(1)`로 부팅 차단(PM2/k8s 재시작 백오프 유도)
- 기존 `_instrumentation.ts`(주석 문서 아카이브)는 삭제. `onRequestError` 훅 예시 등 상세 설명은 Git 히스토리 또는 `instrumentation.ts` 상단 주석 참조

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

### 🛡️ 미인증 차단 layered defense (신규)
프로젝트 정책: **비로그인 사용자가 접근 가능한 화면이 0개** 임을 전제로, 다음 두 레이어가 독립적으로 미인증 호출을 차단한다.

- **Layer 1 — `proxy.ts` (페이지 진입 차단)**
  - 보호 경로 진입 시 `getToken()` 으로 JWT 검증, 미인증이면 `/login` 리다이렉트
  - 광역 1차 필터. 라우터에 닿기 전에 끊어 후속 비용(DB 풀, ALS 셋업) 자체를 발생시키지 않음
- **Layer 2 — `actionAgent` + ALS (Server Action 차단)**
  - `lib/utils/server/actionWrapper.ts` 의 `buildRequestContext` 에서 `auth()` 호출
  - 세션 없음 / `auth()` throw 모두 `redirect('/login')` 으로 통일 처리
  - `auth()` 시스템 장애 시 `action.auth_failed` 로 1회 로깅 후 redirect (사일런트 누락 방지)
  - `redirect()` 는 `NEXT_REDIRECT` 에러를 throw 하므로 반드시 `actionAgent` try/catch **바깥**에서 호출
- **Layer 3 — DB 레이어 최후 안전망**
  - `lib/db/factory.ts` 의 `withLifecycle` 진입 시 ALS 의 `empno` 부재 시 `DbError(category:'auth')` throw
  - 정상 경로에선 발동하지 않지만, 내부 호출이 `actionAgent` 우회 시 마지막 차단

#### 시스템/프레임워크 전용 우회 경로 — `getSysDb()`
- 인증/로깅 등 **JWT 인증을 우회해야 하는 시스템 쿼리** 전용 진입점
- `withLifecycle` 우회 → ALS 가드 / 로깅 / tx 미지원
- 사용처: `lib/auth/auth.ts` 의 EMP 조회, `OracleDbLogger` (운영 전환 시)
- "로거가 자기 자신을 로깅" 하는 무한 재귀 원천 차단

### 클라이언트 NEXT_REDIRECT digest 필터링
- `lib/utils/client/useAction.ts` 의 catch 블록에서 `digest.startsWith('NEXT_REDIRECT')` 감지 시 rethrow
- 정상 네비게이션을 토스트/전역 에러 핸들러로 빠지지 않게 분리
- 결과: 세션 만료 redirect 시 "NEXT_REDIRECT" 토스트 노출 사라짐

### 요청 컨텍스트(ALS) 강화
- `lib/utils/server/requestContext.ts` 의 `RequestContext` 모든 필드 `readonly` 화
- `runWithRequestContext` 가 `Object.freeze` 로 최상위 동결 → 하위 코드의 변경 차단
- 불필요해진 `loggable` 플래그 제거 — `withLifecycle` 가 실행되는 모든 경로는 사용자 액션이므로 무조건 로깅
- 추후 데이터 비즈니스 로직에서 `getRequestContext()` 가 안전하게 활용 가능

### DB 로그 INSERT 구현 가이드
- `lib/db/logger.ts` 의 `OracleDbLogger` 예시를 `getSysDb()` 기반으로 재작성
- 운영 전환 시 별도 `DB_CONNECTION__LOG` 환경변수만 추가하면 코드 변경 없이 분리 가능
- 3-tier traceId(`traceId` / `parentTraceId` / `actionTraceId`), `startedAt` / `endedAt` 등 풀 필드 INSERT 구조

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
├── test-0512/             # Cascade Select + Function dataSource + Suspense 예제
│   ├── page.tsx           # JOB → EMPNO/ENAME cascade + Grid (/test-0512)
│   └── _actions/
│       └── main.ts        # fetchJobOptions / fetchEmpnoOptions / fetchEnameOptions / fetchEmpList
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
├── constants.ts         # 전역 상수 (네비게이션, 샘플 데이터)
├── hooks/
│   └── useDataSource.ts # 배열/Promise/함수형 dataSource 통합 처리 훅 (data/isLoading/error)
├── search-queries.ts    # CompSearch Route Handler 전용 DB 조회 모듈
├── utils/
│   ├── index.ts         # public barrel: cn/delay/formatDate + AppError/ActionResponse/ActionError/ErrorType
│   ├── common.ts        # 공통 유틸리티 함수 (구 utils.ts)
│   ├── type.ts          # 에러 프레임워크 핵심 타입: ActionError(plain), AppError(class), ActionResponse, ErrorType (구 type/index.ts)
│   ├── client/
│   │   ├── index.ts             # client barrel: useAction, handleGlobalError
│   │   ├── useAction.ts         # ActionResponse envelope 처리 훅. ActionError → AppError 복원
│   │   └── globalErrorHandler.ts # AppError/Error → Toast UI 출력 단일 진입점
│   └── server/
│       ├── index.ts             # server barrel: actionAgent (Server Action 파일에서만 import)
│       └── actionWrapper.ts     # actionAgent<T>(): Server Action → ActionResponse 래핑, 에러 → ActionError 변환
└── db/                  # Database 모듈 (팩토리 아키텍처)
    ├── index.ts         # public barrel: getDb / getDbClient(deprecated shim) / 타입 re-export
    ├── factory.ts       # getDb(name) 팩토리 — lifecycle(로그·에러변환)·캐싱·graceful drain (레지스트리 방식)
    ├── factory-new.ts   # getDb(name) 팩토리 — 환경변수 전용, 레지스트리·암호화 의존 없음
    ├── errors.ts        # DbError 표준 에러 클래스 + Oracle 에러 코드 → category 매핑
    ├── logger.ts        # 구조화 쿼리 로거 (JSON, SQL preview, 바인드 shape)
    ├── secret.ts        # AES-256-GCM connectString 암·복호화 헬퍼
    ├── types.ts         # IDbClient, BindParams, QueryOptions(공개), InternalQueryOptions(내부) 등 타입
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
12. **Oracle Transaction** — [test-0419](http://localhost:3000/test-0419) (`db.tx()` ALS 기반 트랜잭션 — 다중 UPDATE commit/rollback 원자성 검증)
13. **Cascade Select + Function dataSource** — [test-0512](http://localhost:3000/test-0512) (JOB → EMPNO/ENAME cascade + `QueryResult` 메타 기반 Grid 자동 컬럼 추론)

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

## 🆕 최근 변경 사항 (Recent Changes)

### Multi-DB Provider 확장 & dataSource 정규화 헬퍼 도입

**DB 레이어 (`lib/db/`)**
- `ProviderName` union 에 `postgres`, `mssql` 을 추가하여 멀티 DB 백엔드를 지원한다.
  - `lib/db/providers/postgres.ts` — `pg` 드라이버 기반 PostgreSQL 프로바이더 신규 추가.
  - `lib/db/providers/mssql.ts` — `mssql` 드라이버 기반 SQL Server 프로바이더 신규 추가.
  - `lib/db/providers/index.ts` 의 프로바이더 레지스트리에 위 두 항목 등록.
- `lib/db/errors.ts` 에 DB 별 에러 분류기 추가:
  - `categorizePostgresError()` — PostgreSQL **SQLSTATE 5자리** 코드와 Node 네트워크 errno(`ECONNREFUSED` 등) 를 함께 처리하여 `DbErrorCategory`(`connection` / `timeout` / `constraint` / `permission` / `syntax` / `unknown`) 로 매핑.
  - `categorizeMssqlError()` — mssql 드라이버의 `.code`(`ELOGIN`, `ETIMEOUT`, `ESOCKET` 등) 와 SQL Server native `.number`(2627, 547, 18456, 1205 …) 를 함께 매핑.
- 신규 의존성: `pg` / `@types/pg`, `mssql` / `@types/mssql`.

**공용 컴포넌트 데이터 소스 표준화 (`lib/utils/client/`)**
- `lib/utils/client/unwrapEnvelope.ts` 모듈 신규 추가.
  - `DataSource<T>` 표준 타입: 동기 값 / `Promise` / 무인자 함수 / `ActionResponse<T>` envelope 포함 형태를 모두 허용.
  - `resolveDataSource(src)` — 어떤 형태의 입력이든 `Promise<T>` 로 정규화. Server Action 함수가 렌더 중 직접 호출되는 경우의 Router setState 경고를 피하기 위해 microtask 로 한 박자 지연 호출.
  - `unwrapEnvelope(value)` — `ActionResponse` 실패 시 `ActionError → AppError` 복원 후 `handleGlobalError()` 1회 호출 + `AppError` throw → 컴포넌트 외곽 `ErrorBoundary` 로 전파.
  - `isActionResponse(v)` 타입 가드.
- `lib/utils/client/index.ts` 배럴에서 위 항목들을 re-export.

**Grid 컴포넌트 (`components/control/Grid.tsx`)**
- 내부에서 직접 구현하던 envelope 언래핑 / Promise 정규화 로직 제거 → `resolveDataSource()` 1줄로 대체.
- `DataSource<T>` 는 표준 `DataSource<T[]>` 로 특수화하여 정의.
- `useRef` 캐시 값을 `Promise<Row[]>` 로 통일 → `use()` 분기 코드 제거로 가독성 개선.
- 동작은 동일하지만, 다른 공용 컨트롤(InputSelect, Chart 등) 도 동일한 1-stop API 를 재사용할 수 있는 기반을 마련.

### DB 로거 factory 우회 & `useAction` 훅 전면 재설계

**DB 로거 (`lib/db/logger.ts`, `lib/db/factory.ts`)**
- `insertLogQuery()` 가 더 이상 `getDb('MAIN').execute(...)` 를 거치지 않고 **provider 를 직접 호출**한다.
  - 기존 방식은 `loggingScope` ALS 플래그로 factory ↔ logger 재귀를 1단계에서 차단하는 우회였으나, 사용자 트랜잭션이 활성화된 컨텍스트에서 로그 INSERT 가 사용자 커넥션에 enlist 되어 **rollback 시 로그가 함께 유실**되고 트랜잭션 수명에 종속되는 문제가 있었다.
  - 또한 사용자가 `MAIN` 이 아닌 다른 DB 트랜잭션 중일 때 factory 의 교차-DB 차단 가드(`tx(...) 스코프 안에서 다른 DB 호출 불허`) 에 걸려 매 쿼리마다 throw 가 발생했다.
- logger 가 `resolveFromEnv('MAIN')` + `getProvider(...)` 로 직접 INSERT 하므로 `txStore` 영향권 밖에서 별도 커넥션이 사용되고, factory ↔ logger 재귀도 원천적으로 발생하지 않는다.
- 이에 따라 `loggingScope` AsyncLocalStorage 가드를 logger / factory 양쪽에서 제거하고, factory 의 query/execute 성공·실패 양 경로에서 `insertLogQuery` 호출을 무조건 실행하도록 단순화했다.

**클라이언트 액션 훅 (`lib/utils/client/useAction.ts`)**
- 기존 envelope(`ActionResponse<T>`) 언래핑 + `AppError` + `handleGlobalError` 기반 설계를 폐기하고, **DB 에서 throw 된 raw 에러가 ServerAction 경계를 그대로 통과**하는 흐름을 전제로 재설계.
- 새 API: `executeAction<R>(factory, opts?)` — 성공 시 결과값을, 실패 시 `null` 을 반환하며 훅이 내부적으로 alert 처리한다.
- 에러 분류기 `classifyError()` 추가:
  - `AbortError` → 조용히 무시 (`aborted`)
  - `TypeError(/fetch|network/i)` → 네트워크 단절 안내 (`network`)
  - `digest` 가 붙은 ServerAction 에러 → 마스킹된 메시지를 가정하고 일반 안내 (`server`)
  - 그 외 → `unknown`
- `NEXT_REDIRECT` / `NEXT_NOT_FOUND` 는 `digest` 문자열 검사로 정상 네비게이션 분기를 분리하여 Next 런타임으로 rethrow.
- 반환 상태: `{ executeAction, isLoading, isError, error, errorKind, data, reset }`.

**예제 (`app/test-0512/`)**
- `_actions/main.ts` 의 Server Action 들을 화살표 함수 + `actionAgent` 래퍼 형태에서 **`export async function`** 으로 단순화하여 envelope 가공 없이 raw throw 가 그대로 위로 올라가도록 변경.
- `fetchEmpList` 에 `db.transaction(...)` cascade 예제 추가 (INSERT → 정상 SELECT → 의도적 실패 SELECT 로 rollback 시연).
- `page.tsx` 에 새 `useAction` 훅을 사용하는 `hookTest` 버튼을 추가하여 raw throw → 훅 분류 → alert 흐름을 시연.

### DB 로거 hot path 최적화 — `logTarget` 모듈 캐싱

**`lib/db/logger.ts`**
- `insertLogQuery()` 가 매 호출마다 `resolveFromEnv('MAIN')` + `getProvider(...)` 를 재실행하던 것을 **모듈 스코프에 1회 캐싱** 하도록 변경.
  - 로그 적재 대상은 항상 `'MAIN'` 으로 고정이고 env 는 프로세스 부팅 후 불변이므로, 매 쿼리마다 호출되는 hot path 에서 동일한 해석 비용을 반복할 이유가 없다.
  - `type LogTarget = { provider: IDbProvider } & EnvResolveResult` 형태로 묶어 `getLogTarget()` 헬퍼가 lazy 초기화 + 캐시 hit 시 즉시 반환하도록 구성.
  - env 미설정 상태에서는 캐싱하지 않아 추후 호출에서 재시도가 가능하다.
- 사용하지 않던 `sqlPreview()` 유틸리티를 제거(주석 처리)하여 모듈 표면적을 축소.

---

이 프로젝트를 통해 Next.js 16의 모든 라우팅 패턴을 **직접 구현하고 동작을 관찰**하며 깊이 있게 학습할 수 있습니다.
