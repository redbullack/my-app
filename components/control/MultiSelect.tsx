/**
 * @component MultiSelect
 * @description
 * 체크박스 기반의 멀티셀렉트 컴포넌트.
 * options 배열의 항목을 체크박스 목록으로 표시하고,
 * 선택된 값은 value 배열로 관리된다.
 * 라이트/다크 테마 모두 지원한다.
 */
'use client'

import { cn } from '@/lib/utils'

interface MultiSelectProps {
  options: string[]
  value: string[]
  onChange: (selected: string[]) => void
  label?: string
  className?: string
}

export default function MultiSelect({
  options,
  value,
  onChange,
  label,
  className,
}: MultiSelectProps) {
  function toggle(option: string) {
    if (value.includes(option)) {
      onChange(value.filter(v => v !== option))
    } else {
      onChange([...value, option])
    }
  }

  function toggleAll() {
    if (value.length === options.length) {
      onChange([])
    } else {
      onChange([...options])
    }
  }

  const allSelected = value.length === options.length
  const noneSelected = value.length === 0

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label && (
        <span className="text-sm font-medium text-[var(--color-text-primary)]">{label}</span>
      )}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-3">
        {/* 전체 선택 */}
        <label className="flex cursor-pointer items-center gap-2 border-b border-[var(--color-border)] pb-2 mb-2 select-none">
          <input
            type="checkbox"
            checked={allSelected}
            ref={el => {
              if (el) el.indeterminate = !noneSelected && !allSelected
            }}
            onChange={toggleAll}
            className="h-4 w-4 rounded accent-[var(--color-accent)] cursor-pointer"
          />
          <span className="text-sm font-medium text-[var(--color-text-secondary)]">
            전체 선택 ({value.length}/{options.length})
          </span>
        </label>

        {/* 개별 옵션 목록 */}
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
          {options.map(option => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 select-none hover:bg-[var(--color-bg-tertiary)] transition-colors"
            >
              <input
                type="checkbox"
                checked={value.includes(option)}
                onChange={() => toggle(option)}
                className="h-4 w-4 rounded accent-[var(--color-accent)] cursor-pointer"
              />
              <span className="text-sm text-[var(--color-text-primary)]">{option}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
