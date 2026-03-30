/**
 * @component Header
 * @description
 * 전역 네비게이션 헤더. 로고, 주요 네비게이션 링크, 테마 토글을 포함한다.
 * Client Component: Link 클릭과 모바일 메뉴 토글 등 상호작용이 필요하다.
 */
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { NAV_ITEMS } from '@/lib/constants'
import ThemeToggle from './ThemeToggle'

export default function Header() {
  const { data: session } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg-primary/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        {/* 로고 */}
        <Link href="/" className="text-lg font-bold text-accent">
          Next.js 16 Lab
        </Link>

        {/* 데스크톱 네비게이션 */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {session?.user ? (
            <div className="hidden items-center gap-2 md:flex">
              <span className="text-sm text-text-secondary">
                {session.user.name}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="rounded-md px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
              >
                로그아웃
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="hidden rounded-md px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors md:block"
            >
              로그인
            </Link>
          )}
          <ThemeToggle />
          {/* 모바일 햄버거 */}
          <button
            className="rounded-md p-2 text-text-secondary hover:bg-bg-tertiary md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="메뉴 토글"
          >
            {mobileOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* 모바일 메뉴 */}
      {mobileOpen && (
        <nav className="border-t border-border bg-bg-primary px-4 py-2 md:hidden">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-bg-tertiary"
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
              {item.description && (
                <span className="ml-2 text-xs text-text-muted">({item.description})</span>
              )}
            </Link>
          ))}
          {session?.user ? (
            <div className="border-t border-border mt-2 pt-2">
              <span className="block px-3 py-1 text-xs text-text-muted">{session.user.name}</span>
              <button
                onClick={() => { setMobileOpen(false); signOut({ callbackUrl: '/login' }) }}
                className="block w-full rounded-md px-3 py-2 text-left text-sm text-text-secondary hover:bg-bg-tertiary"
              >
                로그아웃
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="block rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-bg-tertiary"
              onClick={() => setMobileOpen(false)}
            >
              로그인
            </Link>
          )}
        </nav>
      )}
    </header>
  )
}
