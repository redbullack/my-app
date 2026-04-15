/**
 * @component Toast
 * @description
 * 싱글톤 스타일 토스트. 어디서든 `toast(message, options)` 로 호출 가능하며
 * 루트 레이아웃에 1회 마운트된 `<ToastHost />` 가 실제로 렌더한다.
 *
 * 내부적으로 경량 pub/sub 스토어를 사용하므로 훅이 아닌 일반 함수/비React 코드에서도
 * 호출할 수 있다. (handleGlobalError 같은 함수에서 사용)
 */
'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export type ToastVariant = 'info' | 'success' | 'warning' | 'error'

export interface ToastItem {
  id: string
  variant: ToastVariant
  title?: string
  message: string
  /** 선택적 액션 버튼 — 재시도/이동 등 */
  action?: { label: string; onClick: () => void }
  /** traceId 뒷 8자를 작게 표시 */
  traceId?: string
  /** 자동 dismiss ms. 0이면 수동 닫기만. 기본 5000. */
  durationMs?: number
}

interface ToastProps extends ToastItem {
  onClose: (id: string) => void
}

const VARIANT_CLASS: Record<ToastVariant, string> = {
  info: 'border-l-4 border-l-accent',
  success: 'border-l-4 border-l-success',
  warning: 'border-l-4 border-l-warning',
  error: 'border-l-4 border-l-error',
}

export function Toast({
  id,
  variant,
  title,
  message,
  action,
  traceId,
  durationMs = 5000,
  onClose,
}: ToastProps) {
  useEffect(() => {
    if (!durationMs) return
    const timer = window.setTimeout(() => onClose(id), durationMs)
    return () => window.clearTimeout(timer)
  }, [id, durationMs, onClose])

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-auto w-80 rounded-lg bg-bg-primary p-3 shadow-lg border border-border',
        VARIANT_CLASS[variant],
      )}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {title && (
            <p className="text-sm font-semibold text-text-primary">{title}</p>
          )}
          <p className="text-sm text-text-secondary break-words">{message}</p>
          {traceId && (
            <p className="mt-1 text-[10px] font-mono text-text-muted">
              {traceId.slice(0, 8)}
            </p>
          )}
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="mt-2 text-xs font-medium text-accent hover:text-accent-hover"
            >
              {action.label}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => onClose(id)}
          className="shrink-0 rounded p-0.5 text-text-muted hover:bg-bg-tertiary hover:text-text-primary"
          aria-label="닫기"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

interface ToastStackProps {
  toasts: ToastItem[]
  onClose: (id: string) => void
}

export function ToastStack({ toasts, onClose }: ToastStackProps) {
  if (toasts.length === 0) return null
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex flex-col gap-2">
      {toasts.map(t => (
        <Toast key={t.id} {...t} onClose={onClose} />
      ))}
    </div>
  )
}

/* ── 싱글톤 스토어 ─────────────────────────────────────────────────── */

type ToastInput = Omit<ToastItem, 'id' | 'variant' | 'message'> & {
  variant?: ToastVariant
}

let items: ToastItem[] = []
const listeners = new Set<(next: ToastItem[]) => void>()

function emit() {
  for (const l of listeners) l(items)
}

/**
 * 어디서나 호출 가능한 토스트 함수.
 * 예: `toast('저장 완료', { variant: 'success' })`
 */
export function toast(message: string, opts: ToastInput = {}): string {
  const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  items = [...items, { ...opts, id, variant: opts.variant ?? 'info', message }]
  emit()
  return id
}

export function dismissToast(id: string) {
  items = items.filter(t => t.id !== id)
  emit()
}

/**
 * 루트 레이아웃에 한 번만 마운트한다.
 * toast() 호출 결과를 실제로 화면에 렌더한다.
 */
export function ToastHost() {
  const [list, setList] = useState<ToastItem[]>(items)
  useEffect(() => {
    listeners.add(setList)
    return () => {
      listeners.delete(setList)
    }
  }, [])
  return <ToastStack toasts={list} onClose={dismissToast} />
}

export default Toast
