/**
 * @component Input
 * @description
 * label, placeholder, error, helperText를 지원하는 텍스트 입력 컴포넌트.
 * 포커스/에러 스타일이 다크 모드에서도 올바르게 표시된다.
 * type으로 text/password/email/number/search/select를 지원한다.
 * select 타입은 가상화된 드롭다운 멀티셀렉트를 제공한다.
 */
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn } from '@/lib/utils'
import type { SelectOption } from '@/types'

type InputType = 'text' | 'password' | 'email' | 'number' | 'search' | 'select'

interface InputBaseProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  type?: InputType
  label?: string
  error?: string
  helperText?: string
}

interface InputTextProps extends InputBaseProps {
  type?: Exclude<InputType, 'select'>
  value?: string
  onChange?: React.ChangeEventHandler<HTMLInputElement>
  dataSource?: never
}

interface InputSelectProps extends InputBaseProps {
  type: 'select'
  value?: string[]
  onChange?: (selected: string[]) => void
  dataSource?: SelectOption[]
  disabled?: boolean
}

export type InputProps = InputTextProps | InputSelectProps

export default function Input(props: InputProps) {
  if (props.type === 'select') {
    return <InputSelect {...props} />
  }

  const {
    type = 'text',
    label,
    error,
    helperText,
    className,
    id,
    dataSource: _,
    ...rest
  } = props as InputTextProps

  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-text-primary">
          {label}
        </label>
      )}
      <input
        id={inputId}
        type={type}
        className={cn(
          'rounded-lg border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent',
          error ? 'border-error' : 'border-border',
          className,
        )}
        {...rest}
      />
      {error && <p className="text-xs text-error">{error}</p>}
      {!error && helperText && <p className="text-xs text-text-muted">{helperText}</p>}
    </div>
  )
}

/**
 * select 타입 전용 내부 컴포넌트.
 * 드롭다운 멀티셀렉트를 @tanstack/react-virtual로 가상화하여 수천 건의 옵션을 부드럽게 처리한다.
 */
function InputSelect({
  label,
  error,
  helperText,
  className,
  id,
  value = [],
  onChange,
  dataSource = [],
  disabled = false,
}: InputSelectProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const filtered = search
    ? dataSource.filter(opt =>
        opt.label.toLowerCase().includes(search.toLowerCase()) ||
        opt.value.toLowerCase().includes(search.toLowerCase())
      )
    : dataSource

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 32,
    overscan: 10,
  })

  const toggle = useCallback((optValue: string) => {
    if (!onChange) return
    if (value.includes(optValue)) {
      onChange(value.filter(v => v !== optValue))
    } else {
      onChange([...value, optValue])
    }
  }, [value, onChange])

  const toggleAll = useCallback(() => {
    if (!onChange) return
    const filteredValues = filtered.map(o => o.value)
    const allFilteredSelected = filteredValues.every(v => value.includes(v))
    if (allFilteredSelected) {
      onChange(value.filter(v => !filteredValues.includes(v)))
    } else {
      const merged = new Set([...value, ...filteredValues])
      onChange(Array.from(merged))
    }
  }, [value, onChange, filtered])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedLabels = value.length > 0
    ? value.length <= 3
      ? dataSource.filter(o => value.includes(o.value)).map(o => o.label).join(', ')
      : `${value.length}건 선택됨`
    : ''

  return (
    <div className={cn('relative flex flex-col gap-1.5', className)} ref={containerRef}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-text-primary">
          {label}
        </label>
      )}
      <button
        id={inputId}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          'flex items-center justify-between rounded-lg border bg-bg-primary px-3 py-2 text-sm text-left transition-colors min-h-[38px]',
          'focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent',
          error ? 'border-error' : 'border-border',
          disabled ? 'opacity-50 cursor-not-allowed bg-bg-tertiary' : value.length > 0 ? 'text-text-primary' : 'text-text-muted',
        )}
      >
        <span className="truncate">{selectedLabels || '선택하세요'}</span>
        <svg
          className={cn('h-4 w-4 shrink-0 text-text-muted transition-transform', isOpen && 'rotate-180')}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-lg border border-border bg-bg-primary shadow-lg">
          {/* 검색 필터 */}
          <div className="border-b border-border p-2">
            <input
              type="text"
              placeholder="검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded border border-border bg-bg-secondary px-2 py-1 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/50"
              autoFocus
            />
          </div>

          {/* 전체 선택 */}
          <div className="border-b border-border px-3 py-1.5">
            <label className="flex cursor-pointer items-center gap-2 select-none">
              <input
                type="checkbox"
                checked={filtered.length > 0 && filtered.every(o => value.includes(o.value))}
                ref={el => {
                  if (el) {
                    const filteredValues = filtered.map(o => o.value)
                    const selectedCount = filteredValues.filter(v => value.includes(v)).length
                    el.indeterminate = selectedCount > 0 && selectedCount < filtered.length
                  }
                }}
                onChange={toggleAll}
                className="h-4 w-4 rounded accent-accent cursor-pointer"
              />
              <span className="text-xs font-medium text-text-secondary">
                전체 선택 ({value.length}/{dataSource.length})
              </span>
            </label>
          </div>

          {/* 가상화된 옵션 리스트 */}
          <div
            ref={scrollRef}
            className="max-h-60 overflow-auto"
          >
            <div
              style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}
            >
              {virtualizer.getVirtualItems().map(virtualItem => {
                const opt = filtered[virtualItem.index]
                const isSelected = value.includes(opt.value)
                return (
                  <div
                    key={virtualItem.key}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <label
                      className="flex cursor-pointer items-center gap-2 px-3 h-full select-none hover:bg-bg-tertiary transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(opt.value)}
                        className="h-3.5 w-3.5 rounded accent-accent cursor-pointer"
                      />
                      <span className="text-sm text-text-primary truncate">{opt.label}</span>
                    </label>
                  </div>
                )
              })}
            </div>
          </div>

          {filtered.length === 0 && (
            <div className="px-3 py-4 text-center text-sm text-text-muted">
              검색 결과가 없습니다
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-error">{error}</p>}
      {!error && helperText && <p className="text-xs text-text-muted">{helperText}</p>}
    </div>
  )
}
