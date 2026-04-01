/**
 * @component Header
 * @description
 * 전역 네비게이션 헤더. 로고, 주요 네비게이션 링크, 테마 토글을 포함한다.
 * Client Component: Link 클릭과 모바일 메뉴 토글 등 상호작용이 필요하다.
 *
 * Overflow Nav: ResizeObserver로 nav 컨테이너 너비를 측정하여 공간이 부족할 때
 * 마지막 visible 아이템 옆에 "더보기" 드롭다운 버튼을 자동으로 표시한다.
 *
 * 너비 측정은 화면 밖 hidden 컨테이너에서 수행하여, 드롭다운 overflow-hidden
 * 문제 없이 정확한 값을 얻는다.
 */
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { NAV_ITEMS } from '@/lib/constants'
import ThemeToggle from './ThemeToggle'

/** 드롭다운 더보기 버튼의 예상 너비(px). 측정 전 공간 계산에 사용 */
const OVERFLOW_BTN_WIDTH = 40

export default function Header() {
  const { data: session } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [overflowOpen, setOverflowOpen] = useState(false)
  /** 드롭다운 없이 nav에 표시할 수 있는 아이템 수 */
  const [visibleCount, setVisibleCount] = useState(NAV_ITEMS.length)

  const navRef = useRef<HTMLElement>(null)
  /** 너비 측정 전용 오프스크린 컨테이너 */
  const measureRef = useRef<HTMLDivElement>(null)
  const itemWidthsRef = useRef<number[]>([])
  const dropdownRef = useRef<HTMLDivElement>(null)

  /** 오프스크린 컨테이너에서 각 nav 아이템 너비를 측정 */
  const measureItemWidths = useCallback(() => {
    if (!measureRef.current) return
    const items = measureRef.current.querySelectorAll<HTMLElement>('[data-nav-item]')
    itemWidthsRef.current = Array.from(items).map(el => el.getBoundingClientRect().width)
  }, [])

  /** 컨테이너 너비에 따라 몇 개까지 표시할지 계산 */
  const recalcVisibleCount = useCallback(() => {
    if (!navRef.current) return
    const containerWidth = navRef.current.getBoundingClientRect().width
    const widths = itemWidthsRef.current
    if (widths.length === 0) return

    const GAP = 4 // gap-1 = 4px

    let used = 0
    let count = 0
    for (let i = 0; i < widths.length; i++) {
      const itemWidth = widths[i] + (i > 0 ? GAP : 0)
      const hasMore = i < widths.length - 1
      // 더보기 버튼이 필요한 경우 그 너비도 예약
      const extra = hasMore ? OVERFLOW_BTN_WIDTH + GAP : 0
      if (used + itemWidth + extra <= containerWidth) {
        used += itemWidth
        count++
      } else {
        break
      }
    }
    setVisibleCount(count)
  }, [])

  // 초기 측정 및 ResizeObserver 등록
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      measureItemWidths()
      recalcVisibleCount()
    })

    const observer = new ResizeObserver(() => recalcVisibleCount())
    if (navRef.current) observer.observe(navRef.current)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [measureItemWidths, recalcVisibleCount])

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    if (!overflowOpen) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOverflowOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [overflowOpen])

  const hiddenItems = NAV_ITEMS.slice(visibleCount)

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg-primary/80 backdrop-blur-md">
      {/* 너비 측정 전용 오프스크린 컨테이너 — 레이아웃에 영향 없음 */}
      <div
        ref={measureRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute flex gap-1"
      >
        {NAV_ITEMS.map(item => (
          <span
            key={item.href}
            data-nav-item
            className="shrink-0 rounded-md px-3 py-1.5 text-sm"
          >
            {item.label}
          </span>
        ))}
      </div>

      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        {/* 로고 + 데스크톱 네비게이션: 하나의 flex 그룹으로 묶어 우측 영역과 겹침 방지 */}
        <div className="hidden min-w-0 flex-1 items-center gap-4 md:flex">
          <Link href="/" className="shrink-0 text-lg font-bold text-accent">
            Next.js 16 Lab
          </Link>

          <nav ref={navRef} className="flex min-w-0 flex-1 items-center gap-1">
            {NAV_ITEMS.slice(0, visibleCount).map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-md px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
              >
                {item.label}
              </Link>
            ))}

            {/* 오버플로 드롭다운 버튼 */}
            {hiddenItems.length > 0 && (
              <div ref={dropdownRef} className="relative shrink-0">
                <button
                  onClick={() => setOverflowOpen(v => !v)}
                  aria-label="더 많은 메뉴 보기"
                  aria-expanded={overflowOpen}
                  className="flex items-center gap-0.5 rounded-md px-2 py-1.5 text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
                >
                  <span className="text-xs font-medium">+{hiddenItems.length}</span>
                  <svg
                    width="12" height="12" viewBox="0 0 12 12"
                    fill="none" stroke="currentColor" strokeWidth="1.8"
                    className={`transition-transform duration-150 ${overflowOpen ? 'rotate-180' : ''}`}
                  >
                    <polyline points="2,4 6,8 10,4" />
                  </svg>
                </button>

                {overflowOpen && (
                  <div className="absolute left-0 top-full mt-1 min-w-[160px] rounded-md border border-border bg-bg-primary py-1 shadow-lg z-50">
                    {hiddenItems.map(item => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOverflowOpen(false)}
                        className="flex flex-col px-3 py-2 text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
                      >
                        <span>{item.label}</span>
                        {item.description && (
                          <span className="text-xs text-text-muted">{item.description}</span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </nav>
        </div>

        {/* 모바일 로고 (md 미만에서만 표시) */}
        <Link href="/" className="shrink-0 text-lg font-bold text-accent md:hidden">
          Next.js 16 Lab
        </Link>

        <div className="flex shrink-0 items-center gap-2">
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

      {/* 모바일 메뉴 — 전체 아이템 표시 */}
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
