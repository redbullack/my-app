/**
 * @description 프로젝트 전역 상수 정의
 */

import type { NavItem, Post } from '@/types'

/** 메인 네비게이션 항목 */
export const NAV_ITEMS: NavItem[] = [
  { label: '홈', href: '/' },
  { label: 'About', href: '/about', description: 'Route Group (marketing)' },
  { label: 'Pricing', href: '/pricing', description: 'Route Group (marketing)' },
  { label: 'Dashboard', href: '/dashboard', description: 'Route Group (dashboard)' },
  { label: 'Blog', href: '/blog', description: 'Dynamic Segment [slug]' },
  { label: 'Shop', href: '/shop/electronics/phones', description: 'Catch-all [...categories]' },
  { label: 'Docs', href: '/docs', description: 'Optional Catch-all [[...slug]]' },
  { label: 'Feed', href: '/feed', description: 'Parallel Routes @slot' },
  { label: 'Gallery', href: '/gallery', description: 'Intercepting Routes (.)' },
  { label: 'Emp', href: '/emp', description: 'Emp' },
  { label: 'Tabs', href: '/tabs', description: 'tabs' },
  { label: 'Search', href: '/search', description: 'Virtualization + SearchPanel' },
  { label: 'CompSearch', href: '/comp-search', description: 'useTransition + CompGrid/CompChart' },
  { label: 'NewSearch', href: '/new-search', description: 'dataSource + ServerAction + Tab' },
]

/** 샘플 블로그 데이터 */
export const SAMPLE_POSTS: Post[] = [
  {
    slug: 'nextjs-app-router',
    title: 'Next.js App Router 완전 정복',
    content: 'App Router는 Next.js 13에서 도입되어 16에서 안정화된 새로운 라우팅 시스템입니다. 파일 시스템 기반 라우팅을 제공하며, Server Components를 기본으로 사용합니다.',
    date: '2026-03-28',
    excerpt: 'App Router의 핵심 개념과 사용법을 알아봅니다.',
  },
  {
    slug: 'react-server-components',
    title: 'React Server Components 이해하기',
    content: 'Server Components는 서버에서만 실행되는 컴포넌트로, 번들 크기를 줄이고 데이터 페칭을 단순화합니다. use client 지시어 없이 작성된 모든 컴포넌트는 기본적으로 Server Component입니다.',
    date: '2026-03-25',
    excerpt: 'RSC의 동작 원리와 클라이언트 컴포넌트와의 차이를 설명합니다.',
  },
  {
    slug: 'tailwindcss-v4',
    title: 'TailwindCSS v4 새로운 기능',
    content: 'TailwindCSS v4는 CSS 기반 설정, @theme 지시어, 향상된 성능을 제공합니다. tailwind.config.js 대신 CSS 파일에서 직접 테마를 설정할 수 있습니다.',
    date: '2026-03-20',
    excerpt: 'v4에서 달라진 설정 방식과 새 기능을 살펴봅니다.',
  },
]

/** 샘플 갤러리 데이터 */
export const SAMPLE_GALLERY = [
  { id: '1', title: '산의 일출', color: 'bg-amber-500', description: '해발 2000m에서 촬영한 일출 장면' },
  { id: '2', title: '바다의 석양', color: 'bg-rose-500', description: '제주도 해변에서의 석양' },
  { id: '3', title: '도시의 야경', color: 'bg-indigo-500', description: '서울 남산타워에서 본 야경' },
  { id: '4', title: '숲속의 안개', color: 'bg-emerald-500', description: '새벽 숲길의 신비로운 안개' },
  { id: '5', title: '들판의 꽃', color: 'bg-pink-500', description: '봄날 유채꽃 만발한 제주 들판' },
  { id: '6', title: '겨울 호수', color: 'bg-cyan-500', description: '얼어붙은 호수 위의 설경' },
]

/** 샘플 문서 트리 */
export const DOCS_TREE = [
  { slug: [], title: 'Docs 홈', content: '문서 전체 목차입니다.' },
  { slug: ['getting-started'], title: '시작하기', content: '프로젝트 설정 및 설치 방법을 안내합니다.' },
  { slug: ['getting-started', 'installation'], title: '설치', content: 'pnpm create next-app 명령어로 프로젝트를 생성합니다.' },
  { slug: ['routing'], title: '라우팅', content: 'App Router의 라우팅 시스템을 설명합니다.' },
  { slug: ['routing', 'dynamic-routes'], title: '동적 라우트', content: '[param] 문법으로 동적 세그먼트를 정의합니다.' },
  { slug: ['routing', 'parallel-routes'], title: '병렬 라우트', content: '@slot 문법으로 병렬 렌더링을 구현합니다.' },
]
