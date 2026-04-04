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

### DB 연동
- **Oracle DB 통합** — scott.emp 테이블 조회 예제
  - `/emp` 페이지: MultiSelect 필터로 사원명 선택 및 조회 (Server Action / GET / POST 세 가지 방식 비교)
  - `/api/emp` Route Handler: WHERE IN 동적 쿼리 구성 (GET)
  - `/api/emp/[action]` Dynamic Segment Route Handler: Body로 enames 배열을 전달하는 POST 방식 조회 (`/api/emp/search`)
  - `lib/db/` 모듈: DB 팩토리 및 헬퍼 함수

## 🔐 인증 시스템

### next-auth Credentials 인증
- **`/login`** 페이지: Oracle EMP 테이블의 사원명(ENAME)으로 로그인
  - `LoginForm` Client Component — `Input`, `Button`, `Panel` 컨트롤 재사용
  - `signIn('credentials', { redirect: false })` 로 인증 후 `/dashboard` 리다이렉트
  - 로그인 폼에 테스트 계정(`SMITH` / `password123`) 기본값 제공으로 즉시 체험 가능
  - 실패 시 에러 메시지 인라인 표시

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
- **Input** — label, error, helperText, 다양한 type 지원 (`text`/`password`/`email`/`number`/`search`/`select`). `select` 타입은 `@tanstack/react-virtual` 기반 가상화 드롭다운 멀티셀렉트 제공. 로컬 상태(`localValue`) 기반으로 드롭다운 닫힘 시점에만 `onChange` 호출하며, 키보드 탐색(Enter/Esc/Arrow) 완전 지원
- **Select** — options 배열 기반, placeholder 지원
- **Panel** — variant(default/outlined/elevated) 컨테이너
- **Badge** — variant(info/success/warning/error) 상태 표시
- **Modal** — 오버레이 + ESC 키 닫기 지원
- **MultiSelect** — 체크박스 기반 멀티셀렉트 (scott.emp 조회 필터용)
- **Tab** — Uncontrolled/Controlled 탭 전환 UI. `TabSub` 자식의 `label`을 읽어 탭 헤더 렌더링. 모든 탭 콘텐츠를 항상 DOM에 마운트하여 탭 전환 시 내부 상태 유지
- **TabSub** — `Tab`의 자식 마커 컴포넌트. `label` prop을 탭 헤더에 표시하고 `children`을 탭 패널로 렌더링
- **SearchPanel** — 좌측 고정 검색 패널 컨테이너. `children`으로 검색 조건 컨트롤을 받고, Search 버튼 클릭 시 `onSearchClick` 콜백 호출. `isLoading` 상태 지원
- **CompGrid** — 가상화 데이터 그리드 (Compound Component 패턴). `loading` prop이 true이면 내장 스켈레톤 자동 렌더링. `<Suspense>` 래핑 불필요. `CompGrid.Skeleton` 단독 사용 가능. `GridColumn` 타입으로 컬럼 구성, `render` 함수로 셀 커스터마이징 지원
- **CompChart** — 순수 CSS/HTML 수평 막대 차트 (Compound Component 패턴). 외부 차트 라이브러리 없음. `loading` prop으로 내장 스켈레톤 자동 렌더링. `CompChart.Skeleton` 단독 사용 가능

배럴 익스포트로 간편하게 import:
```tsx
import { Button, Input, Select, Panel, Badge, Modal, MultiSelect, Tab, TabSub, SearchPanel, CompGrid, CompChart } from '@/components/control'
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
├── search-queries.ts    # CompSearch Route Handler 전용 DB 조회 모듈
└── db/                  # Database 모듈
    ├── index.ts         # DB 팩토리 함수
    └── oracleClient.ts  # Oracle DB 연결 및 쿼리 헬퍼

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
// getDbClient() 팩토리를 통해 DB 접근 (직접 queryOracle 호출 금지)
import { getDbClient } from '@/lib/db'
import type { Emp } from '@/types/emp'

const db = getDbClient()
const emps = await db.query<Emp>(
  'SELECT * FROM scott.emp WHERE ENAME IN (:ename0, :ename1)',
  { ename0: 'SCOTT', ename1: 'KING' }
)
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
