/**
 * @pattern Client Component — Context API
 * @description
 * 테마 시스템의 핵심 Provider. Context API로 light/dark/system 세 가지 모드를 관리한다.
 * localStorage에 테마를 저장하여 새로고침 후에도 유지하며,
 * system 모드에서는 OS의 prefers-color-scheme 변경을 실시간 감지한다.
 *
 * 사용법: Root Layout에서 <ThemeProvider>로 앱 전체를 감싸면 된다.
 * 하위 컴포넌트에서는 useTheme() 훅으로 현재 테마와 변경 함수에 접근한다.
 */
'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ThemeMode } from '@/types'

interface ThemeContextValue {
  theme: ThemeMode
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('system')
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')

  const applyTheme = useCallback((mode: ThemeMode) => {
    let resolved: 'light' | 'dark'
    if (mode === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    } else {
      resolved = mode
    }
    setResolvedTheme(resolved)
    document.documentElement.classList.toggle('dark', resolved === 'dark')
  }, [])

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode)
    localStorage.setItem('theme', mode)
    applyTheme(mode)
  }, [applyTheme])

  // 초기 마운트: localStorage에서 테마 복원
  useEffect(() => {
    const stored = localStorage.getItem('theme') as ThemeMode | null
    const initial = stored ?? 'system'
    setThemeState(initial)
    applyTheme(initial)
  }, [applyTheme])

  // system 모드일 때 OS 테마 변경 감지
  useEffect(() => {
    if (theme !== 'system') return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [theme, applyTheme])

  return (
    <ThemeContext value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext>
  )
}
