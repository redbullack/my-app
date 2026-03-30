# CLAUDE.md — Next.js 16 Practice Framework

> 이 파일은 에이전트(Claude)가 본 프로젝트에서 작업할 때 항상 참고해야 할 규칙, 컨벤션, 구조 정의서입니다.
> 새로운 기능을 구현하거나 파일을 생성할 때 반드시 이 문서의 규칙을 우선적으로 따르세요.

---

## 1. 프로젝트 개요 (Project Overview)

| 항목 | 내용 |
|------|------|
| 목적 | Next.js 16의 App Router 기능 전체를 학습하고 체험하기 위한 연습용 프레임워크 |
| 프레임워크 | Next.js 16 (App Router) |
| UI 라이브러리 | React 19 |
| 스타일링 | TailwindCSS 4 |
| 언어 | TypeScript (strict mode) |
| 패키지 매니저 | pnpm (선호) / npm 가능 |

---

## 2. 기술 스택 상세 (Tech Stack)

### Next.js 16
- **App Router** 전용 (`/app` 디렉토리). Pages Router는 사용하지 않는다.
- `'use client'` / `'use server'` 지시어를 목적에 맞게 명확히 구분하여 사용한다.
- Server Components를 기본으로 사용하고, 클라이언트 상호작용이 필요한 경우에만 `'use client'`를 선언한다.

### React 19
- `useActionState`, `useFormStatus`, `use()` 등 React 19 신규 훅을 적극 활용한다.
- Server Actions는 별도 `actions/` 파일로 분리하거나 컴포넌트 내부에서 `'use server'`로 선언한다.

### TailwindCSS 4
- TailwindCSS v4 문법을 사용한다. (`@import "tailwindcss"` 방식, `tailwind.config.js` 대신 CSS 기반 설정)
- 커스텀 테마 토큰은 `app/globals.css` 내 CSS 변수(`--color-*`, `--font-*` 등)로 관리한다.
- 모든 css 파일에는 사용된 tailwindcss 문법과 사용법에 대한 간략한 설명이 주석으로 표기된다.
- **절대로 인라인 `style={{}}` 속성으로 색상/폰트를 직접 지정하지 않는다.** 반드시 Tailwind 유틸리티 클래스 또는 CSS 변수를 사용한다.

---

## 3. 디렉토리 구조 (Directory Structure)

```
/app
├── globals.css                  # TailwindCSS 설정, CSS 변수(테마 토큰), 전역 스타일
├── layout.tsx                   # Root Layout: html/body, ThemeProvider, 공통 레이아웃
├── page.tsx                     # 홈(/) 페이지
│
├── (marketing)/                 # Route Group: URL에 영향 없음, 마케팅 레이아웃 그룹
│   ├── layout.tsx
│   ├── about/page.tsx
│   └── pricing/page.tsx
│
├── (dashboard)/                 # Route Group: 대시보드 레이아웃 그룹
│   ├── layout.tsx
│   ├── dashboard/page.tsx
│   └── settings/page.tsx
│
├── blog/                        # 정적 라우트
│   ├── page.tsx                 # 블로그 목록 (/blog)
│   └── [slug]/                  # 동적 세그먼트: /blog/:slug
│       ├── page.tsx
│       └── loading.tsx
│
├── shop/
│   └── [...categories]/         # Catch-all: /shop/a/b/c 모두 매칭
│       └── page.tsx
│
├── docs/
│   └── [[...slug]]/             # Optional Catch-all: /docs 및 /docs/a/b 모두 매칭
│       └── page.tsx
│
├── feed/                        # Parallel Routes 예제
│   ├── layout.tsx               # @feed, @stories 슬롯을 받는 레이아웃
│   ├── page.tsx
│   ├── @feed/
│   │   ├── default.tsx
│   │   └── page.tsx
│   └── @stories/
│       ├── default.tsx
│       └── page.tsx
│
├── gallery/                     # Intercepting Routes 예제
│   ├── page.tsx                 # 갤러리 목록
│   └── [id]/
│       └── page.tsx             # 갤러리 상세 (full page)
│
├── @modal/                      # Intercepting용 Parallel Route 슬롯
│   └── (.)gallery/[id]/
│       └── page.tsx             # 모달로 가로채기 (같은 레벨 intercept)
│
├── api/                         # Route Handlers
│   ├── hello/route.ts
│   └── revalidate/route.ts
│
└── _components/                 # Private folder: 라우팅에서 제외된 공유 컴포넌트
    └── (이 폴더의 파일들은 라우팅 대상이 아님)

/components
├── control/                     # 재사용 UI 컨트롤 컴포넌트
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Select.tsx
│   ├── Panel.tsx
│   ├── Badge.tsx
│   ├── Modal.tsx
│   └── index.ts                 # 배럴 익스포트
├── layout/                      # 레이아웃 관련 컴포넌트
│   ├── Header.tsx
│   ├── Sidebar.tsx
│   ├── Footer.tsx
│   └── ThemeToggle.tsx
└── shared/                      # 페이지 간 공유 컴포넌트
    ├── CodeBlock.tsx
    └── RouteInfo.tsx            # 현재 라우팅 패턴 설명 표시용

/lib
├── utils.ts                     # 공통 유틸리티 함수
└── constants.ts                 # 프로젝트 전역 상수

/types
└── index.ts                     # 공통 TypeScript 타입 정의

/actions
└── *.ts                         # Server Actions 파일들 ('use server' 선언)
```

---

## 4. App Router 라우팅 패턴 규칙

모든 라우팅 패턴은 반드시 **실제 동작하는 예제 페이지**로 구현되어야 하며, 각 페이지 상단에 해당 패턴에 대한 **주석 설명**이 있어야 한다.

### 4-1. 반드시 포함되어야 할 패턴

| 패턴 | 폴더 예시 | 설명 |
|------|-----------|------|
| 기본 라우트 | `app/about/page.tsx` | 정적 URL 매핑 |
| 동적 세그먼트 | `app/blog/[slug]/page.tsx` | URL 파라미터 |
| Catch-all | `app/shop/[...categories]/page.tsx` | 다단계 경로 전체 캡처 |
| Optional Catch-all | `app/docs/[[...slug]]/page.tsx` | 루트 포함 다단계 경로 캡처 |
| Route Group | `app/(marketing)/`, `app/(dashboard)/` | URL 영향 없는 레이아웃 그룹 |
| Parallel Routes | `app/feed/@feed/`, `app/feed/@stories/` | 슬롯 기반 병렬 렌더링 |
| Intercepting Routes | `app/@modal/(.)gallery/[id]/` | 현재 컨텍스트 유지한 라우트 가로채기 |
| Private Folder | `app/_components/` | 라우팅 제외 폴더 |
| Loading UI | `loading.tsx` | Suspense 기반 로딩 상태 |
| Error UI | `error.tsx` | Error Boundary |
| Not Found | `not-found.tsx` | 404 처리 |
| Route Handler | `app/api/*/route.ts` | API 엔드포인트 |
| Middleware | `middleware.ts` | 요청 가로채기 |

### 4-2. 특수 파일 (Special Files)

모든 라우트 세그먼트에서 필요에 따라 아래 특수 파일들을 활용한다:

- `layout.tsx` — 해당 세그먼트와 하위 세그먼트에 적용되는 레이아웃
- `page.tsx` — 라우트의 실제 UI
- `loading.tsx` — Suspense 기반 로딩 스켈레톤
- `error.tsx` — Error Boundary (`'use client'` 필수)
- `not-found.tsx` — `notFound()` 호출 시 렌더링
- `template.tsx` — 매 탐색마다 새로 마운트되는 레이아웃
- `default.tsx` — Parallel Routes의 fallback UI

---

## 5. 컴포넌트 규칙 (Component Rules)

### 5-1. 파일 상단 주석 (필수)

모든 페이지(`page.tsx`) 및 레이아웃(`layout.tsx`), 컨트롤 컴포넌트 파일 최상단에 아래 형식의 JSDoc 주석을 반드시 작성한다.

```tsx
/**
 * @route /blog/[slug]
 * @pattern Dynamic Segment ([param])
 * @description
 * 동적 세그먼트 패턴. URL의 [slug] 부분이 params.slug로 전달된다.
 * generateStaticParams()를 사용하면 빌드 타임에 정적 생성(SSG)이 가능하다.
 * params가 없으면 요청마다 서버에서 렌더링(SSR)된다.
 */
```

### 5-2. 컴포넌트 분리 원칙

- **단일 책임 원칙**: 하나의 컴포넌트는 하나의 역할만 수행한다.
- **파일 크기 제한**: 단일 파일이 200줄을 초과하면 서브 컴포넌트로 분리를 검토한다.
- **Server / Client 경계 명확화**:
  - 이벤트 핸들러, useState, useEffect → `'use client'`
  - 데이터 fetch, async 컴포넌트 → Server Component (기본값)
- **Props 타입 명시**: 모든 컴포넌트의 props는 `interface` 또는 `type`으로 명시한다.

### 5-3. 배럴 익스포트

`components/control/index.ts`에서 모든 컨트롤을 re-export하여 아래와 같이 임포트 가능하게 한다:

```tsx
import { Button, Input, Select, Panel } from '@/components/control'
```

---

## 6. 테마 시스템 (Theme System)

### 6-1. 지원 테마

| 모드 | 설명 |
|------|------|
| `light` | 라이트 테마 (수동 설정) |
| `dark` | 다크 테마 (수동 설정) |
| `system` | OS 시스템 설정 자동 감지 |

### 6-2. 구현 방식

- `<html>` 태그의 `class`에 `dark`를 토글하는 방식으로 TailwindCSS 4의 `dark:` 변형을 활용한다.
- 테마 상태는 `localStorage`에 `'theme'` 키로 저장하여 새로고침 후에도 유지한다.
- 초기 테마 적용 시 FOUC(Flash of Unstyled Content) 방지를 위해 `layout.tsx`의 `<head>`에 인라인 스크립트를 삽입한다.
- `ThemeProvider`는 Context API 기반의 Client Component로 구현한다.
- `ThemeToggle` 컴포넌트는 Light / Dark / System 세 가지 옵션을 제공한다.

### 6-3. CSS 변수 설계 (`app/globals.css`)

```css
@import "tailwindcss";

:root {
  /* Light theme tokens */
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f8f9fa;
  --color-bg-tertiary: #f1f3f5;
  --color-text-primary: #0f172a;
  --color-text-secondary: #475569;
  --color-text-muted: #94a3b8;
  --color-border: #e2e8f0;
  --color-accent: #3b82f6;
  --color-accent-hover: #2563eb;
}

.dark {
  /* Dark theme tokens */
  --color-bg-primary: #0f172a;
  --color-bg-secondary: #1e293b;
  --color-bg-tertiary: #334155;
  --color-text-primary: #f8fafc;
  --color-text-secondary: #cbd5e1;
  --color-text-muted: #64748b;
  --color-border: #334155;
  --color-accent: #60a5fa;
  --color-accent-hover: #93c5fd;
}
```

### 6-4. 테마 적용 체크리스트

새 컴포넌트나 페이지를 만들 때 아래 사항을 반드시 확인한다:

- [ ] 배경색은 `bg-[var(--color-bg-primary)]` 또는 `dark:` 변형 유틸리티 사용
- [ ] 텍스트 색상은 `text-[var(--color-text-primary)]` 또는 `dark:` 변형 사용
- [ ] 하드코딩된 색상(`text-gray-900`, `bg-white` 등) 단독 사용 금지 — 반드시 `dark:` 쌍으로 작성
- [ ] 보더, 그림자도 다크 모드 대응 여부 확인
- [ ] 아이콘/SVG fill, stroke 색상도 테마 변수 참조

---

## 7. control 컴포넌트 규격 (`components/control/`)

아래 컨트롤들은 **반드시 구현**되어야 하며, 모든 테마(라이트/다크)에서 정상 동작해야 한다.

### Button
```tsx
// variant: 'primary' | 'secondary' | 'ghost' | 'danger'
// size: 'sm' | 'md' | 'lg'
// isLoading, isDisabled 상태 지원
<Button variant="primary" size="md">클릭</Button>
```

### Input
```tsx
// type: 'text' | 'password' | 'email' | 'number' | 'search'
// label, placeholder, error, helperText 지원
// 포커스 스타일, 에러 스타일 다크 모드 대응
<Input label="이메일" type="email" error="올바른 형식이 아닙니다" />
```

### Select
```tsx
// options: { value: string; label: string }[]
// placeholder, disabled 지원
<Select options={[...]} placeholder="선택하세요" />
```

### Panel
```tsx
// variant: 'default' | 'outlined' | 'elevated'
// 내부에 임의의 children을 받는 컨테이너
<Panel variant="elevated"><p>내용</p></Panel>
```

### Badge
```tsx
// variant: 'info' | 'success' | 'warning' | 'error'
<Badge variant="success">완료</Badge>
```

### Modal
```tsx
// isOpen, onClose, title, children
// 다크 모드 오버레이 및 배경 대응
<Modal isOpen={true} onClose={...} title="제목">내용</Modal>
```

---

## 8. 데이터 패칭 패턴 (Data Fetching Patterns)

각 방식의 예제를 반드시 하나 이상 포함한다.

| 방식 | 사용 위치 | 예제 |
|------|-----------|------|
| `async/await` fetch (SSR) | Server Component | `blog/[slug]/page.tsx` |
| `generateStaticParams` (SSG) | 동적 세그먼트 | `blog/[slug]/page.tsx` |
| Route Handler | `app/api/` | REST API 엔드포인트 |
| Server Action | form submit | 폼 데이터 처리 |
| Streaming (Suspense) | `loading.tsx` + `<Suspense>` | 점진적 렌더링 |
| `revalidatePath` / `revalidateTag` | Server Action / Route Handler | 캐시 갱신 |

---

## 9. 코딩 컨벤션 (Coding Conventions)

### 네이밍
- **컴포넌트 파일**: PascalCase (`Button.tsx`, `ThemeToggle.tsx`)
- **페이지/레이아웃**: Next.js 규칙 준수 (`page.tsx`, `layout.tsx`)
- **유틸리티/훅 파일**: camelCase (`useTheme.ts`, `utils.ts`)
- **타입**: PascalCase (`ButtonProps`, `PostData`)
- **상수**: UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`)

### 임포트 순서
```tsx
// 1. React / Next.js
import { useState } from 'react'
import Link from 'next/link'

// 2. 외부 라이브러리
import { clsx } from 'clsx'

// 3. 내부 절대 경로 (@/)
import { Button } from '@/components/control'
import { useTheme } from '@/hooks/useTheme'

// 4. 상대 경로
import './styles.css'
```

### TypeScript
- `any` 타입 사용 금지. 불가피한 경우 `unknown` 사용 후 타입 가드 적용.
- 컴포넌트 반환 타입은 명시하지 않아도 되나, 함수/유틸리티는 반환 타입을 명시한다.
- `interface`는 확장 가능한 객체 형태에, `type`은 유니온/인터섹션 등 복합 타입에 사용한다.

---

## 10. 페이지별 RouteInfo 컴포넌트 사용

각 페이지 하단(또는 상단)에 `<RouteInfo>` 컴포넌트를 삽입하여, 현재 적용된 라우팅 패턴과 설명을 시각적으로 표시한다. 이는 학습 목적의 프로젝트이므로 **모든 예제 페이지에 필수**로 포함한다.

```tsx
<RouteInfo
  pattern="Dynamic Segment"
  syntax="app/blog/[slug]/page.tsx"
  description="URL의 동적 부분을 params 객체로 받아 사용하는 패턴입니다."
  docsUrl="https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes"
/>
```

---

## 11. 작업 흐름 (Agent Workflow)

에이전트가 새로운 기능이나 페이지를 구현할 때 따라야 할 순서:

1. **이 CLAUDE.md 파일을 먼저 읽고** 구조, 컨벤션, 테마 규칙을 파악한다.
2. 기존 파일 구조를 확인하여 **중복 생성 방지** 및 **일관성 유지**한다.
3. Server Component / Client Component 경계를 **명확히 결정**한 후 구현한다.
4. 새 컴포넌트에 **파일 상단 JSDoc 주석** 작성 (§5-1 형식 준수).
5. **테마 체크리스트** (§6-4)를 통과하는지 확인한다.
6. 기존 `components/control/` 컴포넌트를 **재활용**한다. 새 컨트롤이 필요하면 control 폴더에 추가하고 `index.ts`에 re-export 한다.
7. 변경된 파일 목록과 적용된 Next.js 패턴을 **간략히 요약**하여 응답한다.

---

## 12. 자주 쓰는 명령어 (Commands)

```bash
# 개발 서버 실행
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

---

## 13. 참고 문서 (References)

| 주제 | URL |
|------|-----|
| Next.js App Router | https://nextjs.org/docs/app |
| Routing Fundamentals | https://nextjs.org/docs/app/building-your-application/routing |
| Parallel Routes | https://nextjs.org/docs/app/building-your-application/routing/parallel-routes |
| Intercepting Routes | https://nextjs.org/docs/app/building-your-application/routing/intercepting-routes |
| Server Actions | https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations |
| TailwindCSS v4 | https://tailwindcss.com/docs |
| React 19 | https://react.dev/blog/2024/12/05/react-19 |

---

*이 파일은 프로젝트의 살아있는 문서입니다. 새로운 패턴이나 컨벤션이 추가될 때마다 업데이트하세요.*