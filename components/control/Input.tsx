/**
 * @component Input
 * @description
 * label, placeholder, error, helperText를 지원하는 텍스트 입력 컴포넌트.
 * 포커스/에러 스타일이 다크 모드에서도 올바르게 표시된다.
 * type으로 text/password/email/number/search/select를 지원한다.
 * select 타입은 가상화된 드롭다운 멀티셀렉트를 제공한다.
 */
'use client'

import { useState, useRef, useEffect, useCallback, useTransition } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn, type ActionResponse } from '@/lib/utils'
import type { SelectOption } from '@/types'
import { resolveDataSource } from '@/lib/utils/client/unwrapEnvelope'

type InputType = 'text' | 'password' | 'email' | 'number' | 'search' | 'select'

/**
 * dataSource를 지연 로딩하는 함수 타입 (Server Action .bind() 등).
 * SelectOption[] 또는 string[] 둘 다 반환 가능. string[]는 내부에서
 * `{ value, label }` 동일 문자열로 정규화된다.
 */
export type DataSourceFn =
  | (() => Promise<SelectOption[]>)
  | (() => Promise<string[]>)
  | (() => Promise<ActionResponse<SelectOption[]>>)
  | (() => Promise<ActionResponse<string[]>>)

/** Input에 직접 넘길 수 있는 dataSource의 모든 형태 */
export type DataSource = SelectOption[] | string[] | DataSourceFn

/** string[] | SelectOption[] → SelectOption[]로 정규화 */
function normalizeOptions(raw: SelectOption[] | string[] | undefined): SelectOption[] {
  if (!raw || raw.length === 0) return []
  return typeof raw[0] === 'string'
    ? (raw as string[]).map(s => ({ value: s, label: s }))
    : (raw as SelectOption[])
}

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
  /** select 값 변경 콜백. 두 번째 인자로 Input의 id가 함께 전달되어 단일 핸들러에서 분기할 수 있다. */
  onChange?: (selected: string[], id?: string) => void
  dataSource?: DataSource
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
  dataSource,
  disabled = false,
}: InputSelectProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  const [isOpen, setIsOpen] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [localValue, setLocalValue] = useState<string[]>(value)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [focusTarget, setFocusTarget] = useState<'search' | 'list'>('search')
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  /* ── 함수형 dataSource 지연 로딩 ── */
  const isDataSourceFn = typeof dataSource === 'function'
  // console.log(`CLIENT: Input.tsx - inputId: ${inputId} isDataSourceFn: ${typeof dataSource === 'function'}`)
  const [resolvedOptions, setResolvedOptions] = useState<SelectOption[]>([])
  const [isFetching, startFetchTransition] = useTransition()
  const fetchedFnRef = useRef<DataSourceFn | null>(null)

  /* bind() 파라미터 변경 → 함수 참조가 바뀌면 캐시 무효화 */
  useEffect(() => {
    if (isDataSourceFn && fetchedFnRef.current !== dataSource) {
      setResolvedOptions([])
      fetchedFnRef.current = null
    }
  }, [dataSource, isDataSourceFn])

  /** 배열이면 정규화, 함수면 resolve된 결과 사용 (resolvedOptions는 이미 정규화 완료 상태) */
  const options: SelectOption[] = isDataSourceFn
    ? resolvedOptions
    : normalizeOptions(dataSource as SelectOption[] | string[] | undefined)

  /* 외부 value가 변경되면 localValue 동기화 (드롭다운 닫혀있을 때) */
  useEffect(() => {
    if (!isOpen) {
      setLocalValue(value)
    }
  }, [value, isOpen])

  const filtered = search
    ? options.filter(opt =>
      opt.label.toLowerCase().includes(search.toLowerCase()) ||
      opt.value.toLowerCase().includes(search.toLowerCase())
    )
    : options

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 32,
    overscan: 10,
  })

  const toggle = useCallback((optValue: string) => {
    setLocalValue(prev =>
      prev.includes(optValue) ? prev.filter(v => v !== optValue) : [...prev, optValue]
    )
  }, [])

  const toggleAll = useCallback(() => {
    const filteredValues = filtered.map(o => o.value)
    setLocalValue(prev => {
      const allFilteredSelected = filteredValues.every(v => prev.includes(v))
      if (allFilteredSelected) {
        return prev.filter(v => !filteredValues.includes(v))
      }
      return Array.from(new Set([...prev, ...filteredValues]))
    })
  }, [filtered])

  /** 드롭다운을 닫고, 변경이 있으면 부모에게 onChange 전달 */
  const localValueRef = useRef(localValue)
  localValueRef.current = localValue

  const closeDropdown = useCallback(() => {
    setIsOpen(false)
    const snapshot = localValueRef.current
    if (onChange && (snapshot.length !== value.length || snapshot.some((v, i) => v !== value[i]))) {
      queueMicrotask(() => onChange(snapshot, id))
    }
  }, [onChange, value, id])

  /** 드롭다운 열기: localValue를 현재 value로 동기화, 검색 초기화 */
  const openDropdown = useCallback(() => {
    setLocalValue(value)
    setSearchInput('')
    setSearch('')
    setFocusedIndex(-1)
    setFocusTarget('search')
    setIsOpen(true)

    /* 함수형 dataSource: 아직 fetch하지 않았거나 함수 참조가 바뀌었으면 호출 */
    if (isDataSourceFn && fetchedFnRef.current !== dataSource) {
      const fn = dataSource as DataSourceFn
      startFetchTransition(async () => {
        /* envelope 이면 언래핑 → 실패 시 resolveDataSource 내부에서 전역 토스트 후 throw */
        try {
          const result = await resolveDataSource<SelectOption[] | string[]>(fn)
          setResolvedOptions(normalizeOptions(result))
          fetchedFnRef.current = fn
        } catch {
          setResolvedOptions([])
        }
      })
    }
  }, [value, isDataSourceFn, dataSource])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (isOpen) closeDropdown()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, closeDropdown])

  /** 검색 input 키보드 핸들러 — 모든 키 이벤트의 버블링을 차단하여 리스트 핸들러와 분리 */
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Enter') {
      e.preventDefault()
      setSearch(searchInput)
      setFocusedIndex(0)
      setFocusTarget('list')
      listRef.current?.focus()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closeDropdown()
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault()
      setFocusedIndex(0)
      setFocusTarget('list')
      listRef.current?.focus()
    }
  }, [searchInput, closeDropdown])

  /** 리스트 키보드 핸들러 — listRef에 직접 바인딩, 검색 input과 독립 */
  const handleListKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (focusTarget !== 'list') return
    const len = filtered.length
    if (len === 0) return

    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault()
      const next = (focusedIndex + 1) % len
      setFocusedIndex(next)
      virtualizer.scrollToIndex(next)
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const prev = (focusedIndex - 1 + len) % len
      setFocusedIndex(prev)
      virtualizer.scrollToIndex(prev)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const opt = filtered[focusedIndex]
      if (opt) toggle(opt.value)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closeDropdown()
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      /* 글자 입력 시 검색 모드로 복귀 */
      setFocusTarget('search')
      setFocusedIndex(-1)
      searchInputRef.current?.focus()
    }
  }, [focusTarget, focusedIndex, filtered, virtualizer, toggle, closeDropdown])

  /* 드롭다운 열림/닫힘에 따라 표시할 라벨 결정 */
  const displayValue = isOpen ? localValue : value
  const selectedLabels = displayValue.length > 0
    ? displayValue.length <= 3
      ? options.filter(o => displayValue.includes(o.value)).map(o => o.label).join(', ')
      : `${displayValue.length}건 선택됨`
    : ''

  return (
    <div
      className={cn('relative flex flex-col gap-1.5', className)}
      ref={containerRef}
    >
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-text-primary">
          {label}
        </label>
      )}
      <button
        id={inputId}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          if (isOpen) closeDropdown()
          else openDropdown()
        }}
        className={cn(
          'flex items-center justify-between rounded-lg border bg-bg-primary px-3 py-2 text-sm text-left transition-colors min-h-[38px]',
          'focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent',
          error ? 'border-error' : 'border-border',
          disabled ? 'opacity-50 cursor-not-allowed bg-bg-tertiary' : displayValue.length > 0 ? 'text-text-primary' : 'text-text-muted',
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
          {/* 검색 필터 (Enter로 확정) */}
          <div className="border-b border-border p-2">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="검색 후 Enter..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full rounded border border-border bg-bg-secondary px-2 py-1 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/50"
              autoFocus
            />
          </div>

          {/* 전체 선택 */}
          <div className="border-b border-border px-3 py-1.5">
            <label className="flex cursor-pointer items-center gap-2 select-none">
              <input
                type="checkbox"
                checked={filtered.length > 0 && filtered.every(o => localValue.includes(o.value))}
                ref={el => {
                  if (el) {
                    const filteredValues = filtered.map(o => o.value)
                    const selectedCount = filteredValues.filter(v => localValue.includes(v)).length
                    el.indeterminate = selectedCount > 0 && selectedCount < filtered.length
                  }
                }}
                onChange={toggleAll}
                className="h-4 w-4 rounded accent-accent cursor-pointer"
              />
              <span className="text-xs font-medium text-text-secondary">
                전체 선택 ({localValue.length}/{options.length})
              </span>
            </label>
          </div>

          {/* 가상화된 옵션 리스트 */}
          <div
            ref={(el) => {
              scrollRef.current = el
              listRef.current = el
            }}
            tabIndex={-1}
            onKeyDown={handleListKeyDown}
            className="max-h-60 overflow-auto focus:outline-none"
          >
            <div
              style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}
            >
              {virtualizer.getVirtualItems().map(virtualItem => {
                const opt = filtered[virtualItem.index]
                const isSelected = localValue.includes(opt.value)
                const isFocused = virtualItem.index === focusedIndex
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
                      className={cn(
                        'flex cursor-pointer items-center gap-2 px-3 h-full select-none transition-colors',
                        isFocused ? 'bg-accent/10 ring-1 ring-inset ring-accent/30' : 'hover:bg-bg-tertiary',
                      )}
                      onMouseDown={() => {
                        setFocusedIndex(virtualItem.index)
                        setFocusTarget('list')
                        listRef.current?.focus()
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(opt.value)}
                        tabIndex={-1}
                        className="h-3.5 w-3.5 rounded accent-accent cursor-pointer"
                      />
                      <span className="text-sm text-text-primary truncate">{opt.label}</span>
                    </label>
                  </div>
                )
              })}
            </div>
          </div>

          {isFetching && (
            <div className="px-3 py-4 text-center text-sm text-text-muted animate-pulse">
              데이터를 불러오는 중...
            </div>
          )}
          {!isFetching && filtered.length === 0 && (
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
