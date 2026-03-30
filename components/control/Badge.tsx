/**
 * @component Badge
 * @description
 * 상태를 나타내는 작은 라벨 컴포넌트.
 * variant: info(파란) / success(초록) / warning(노란) / error(빨간)
 * 다크 모드에서도 가독성을 유지하도록 배경 투명도와 텍스트 색상을 조정한다.
 */
import { cn } from '@/lib/utils'
import type { BadgeVariant } from '@/types'

interface BadgeProps {
  variant?: BadgeVariant
  className?: string
  children: React.ReactNode
}

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  info: 'bg-info/15 text-info',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  error: 'bg-error/15 text-error',
}

export default function Badge({ variant = 'info', className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        VARIANT_STYLES[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
