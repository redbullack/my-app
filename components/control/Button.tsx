/**
 * @component Button
 * @description
 * 다양한 variant(primary/secondary/ghost/danger)와 size(sm/md/lg)를 지원하는 버튼.
 * isLoading, isDisabled 상태를 통해 인터랙션 제어 가능.
 * 모든 variant는 라이트/다크 테마에서 적절한 대비를 유지한다.
 */
'use client'

import { cn } from '@/lib/utils'
import type { ButtonVariant, Size } from '@/types'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: Size
  isLoading?: boolean
  isDisabled?: boolean
}

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover',
  secondary: 'bg-bg-tertiary text-text-primary hover:bg-border',
  ghost: 'bg-transparent text-text-secondary hover:bg-bg-tertiary',
  danger: 'bg-error text-white hover:opacity-90',
}

const SIZE_STYLES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  isDisabled = false,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50',
        VARIANT_STYLES[variant],
        SIZE_STYLES[size],
        (isDisabled || isLoading) && 'pointer-events-none opacity-50',
        className,
      )}
      disabled={isDisabled || isLoading}
      {...props}
    >
      {isLoading && (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  )
}
