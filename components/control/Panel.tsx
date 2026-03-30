/**
 * @component Panel
 * @description
 * children을 감싸는 컨테이너. variant로 외관을 제어한다:
 * - default: 배경색만 적용
 * - outlined: 테두리 추가
 * - elevated: 그림자 추가 (다크 모드에서는 밝은 보더로 대체)
 */
import { cn } from '@/lib/utils'
import type { PanelVariant } from '@/types'

interface PanelProps {
  variant?: PanelVariant
  className?: string
  children: React.ReactNode
}

const VARIANT_STYLES: Record<PanelVariant, string> = {
  default: 'bg-bg-secondary',
  outlined: 'bg-bg-primary border border-border',
  elevated: 'bg-bg-primary shadow-lg shadow-black/5 border border-border',
}

export default function Panel({ variant = 'default', className, children }: PanelProps) {
  return (
    <div className={cn('rounded-xl p-6', VARIANT_STYLES[variant], className)}>
      {children}
    </div>
  )
}
