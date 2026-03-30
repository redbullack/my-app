/**
 * @component Header
 * @description
 * 전역 네비게이션 헤더. 로고, 주요 네비게이션 링크, 테마 토글을 포함한다.
 * Client Component: Link 클릭과 모바일 메뉴 토글 등 상호작용이 필요하다.
 */
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { NAV_ITEMS } from '@/lib/constants'
import ThemeToggle from './ThemeToggle'

export default function Header() {
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
        </nav>
      )}
    </header>
  )
}
