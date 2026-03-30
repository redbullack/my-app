/**
 * @pattern Client Component
 * @description
 * Light / Dark / System 세 가지 테마를 전환하는 토글 버튼.
 * useTheme() 훅으로 현재 테마 상태를 읽고 변경한다.
 * 각 모드에 대응하는 아이콘(이모지)과 라벨을 표시한다.
 */
'use client'

import { useTheme } from './ThemeProvider'
import type { ThemeMode } from '@/types'

const THEME_OPTIONS: { mode: ThemeMode; icon: string; label: string }[] = [
  { mode: 'light', icon: '☀️', label: 'Light' },
  { mode: 'dark', icon: '🌙', label: 'Dark' },
  { mode: 'system', icon: '💻', label: 'System' },
]

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex items-center gap-1 rounded-lg bg-bg-tertiary p-1">
      {THEME_OPTIONS.map(({ mode, icon, label }) => (
        <button
          key={mode}
          onClick={() => setTheme(mode)}
          className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
            theme === mode
              ? 'bg-bg-primary text-text-primary shadow-sm'
              : 'text-text-muted hover:text-text-secondary'
          }`}
          aria-label={`${label} 테마로 전환`}
        >
          <span>{icon}</span>
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  )
}
