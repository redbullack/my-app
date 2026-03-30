/**
 * @component Select
 * @description
 * options 배열을 받아 드롭다운을 렌더링하는 셀렉트 컴포넌트.
 * placeholder, disabled 상태를 지원하며 테마 토큰 색상을 사용한다.
 */
'use client'

import { cn } from '@/lib/utils'
import type { SelectOption } from '@/types'

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  options: SelectOption[]
  label?: string
  placeholder?: string
}

export default function Select({
  options,
  label,
  placeholder,
  className,
  id,
  ...props
}: SelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-text-primary">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={cn(
          'rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent',
          className,
        )}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
