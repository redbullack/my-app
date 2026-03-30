/**
 * @component Sidebar
 * @description
 * 대시보드 레이아웃 전용 사이드바. (dashboard) Route Group에서 사용한다.
 * 네비게이션 링크와 현재 활성 상태를 표시한다.
 */
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const SIDEBAR_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-bg-secondary p-4">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
        메뉴
      </h2>
      <nav className="flex flex-col gap-1">
        {SIDEBAR_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
              pathname === item.href
                ? 'bg-accent/10 text-accent font-medium'
                : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary',
            )}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
