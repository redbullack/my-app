/**
 * @component Input
 * @description
 * label, placeholder, error, helperText를 지원하는 텍스트 입력 컴포넌트.
 * 포커스/에러 스타일이 다크 모드에서도 올바르게 표시된다.
 * type으로 text/password/email/number/search를 지원한다.
 */
'use client'

import { cn } from '@/lib/utils'

type InputType = 'text' | 'password' | 'email' | 'number' | 'search'

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  type?: InputType
  label?: string
  error?: string
  helperText?: string
}

export default function Input({
  type = 'text',
  label,
  error,
  helperText,
  className,
  id,
  ...props
}: InputProps) {
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
        {...props}
      />
      {error && <p className="text-xs text-error">{error}</p>}
      {!error && helperText && <p className="text-xs text-text-muted">{helperText}</p>}
    </div>
  )
}
