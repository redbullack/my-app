/**
 * @component SearchPanel
 * @description
 * 화면 좌측에 고정되는 검색 패널 컴포넌트.
 * children으로 Input 등의 검색 조건 컨트롤을 받고,
 * Search 버튼 클릭 시 onSearchClick 콜백을 호출한다.
 * 다크/라이트 테마를 모두 지원한다.
 */
'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/control'

interface SearchPanelProps {
  label?: string
  onSearchClick?: () => void
  isLoading?: boolean
  className?: string
  children: React.ReactNode
}

export default function SearchPanel({
  label,
  onSearchClick,
  isLoading = false,
  className,
  children,
}: SearchPanelProps) {
  return (
    <aside
      className={cn(
        'flex flex-col gap-4 rounded-xl border border-border bg-bg-secondary p-5 w-80 shrink-0 self-start sticky top-4',
        className,
      )}
    >
      {label && (
        <h2 className="text-lg font-semibold text-text-primary">{label}</h2>
      )}

      <div className="flex flex-col gap-4">
        {children}
      </div>

      <Button
        variant="primary"
        size="md"
        isLoading={isLoading}
        onClick={onSearchClick}
        className="mt-2 w-full"
      >
        {isLoading ? '조회 중...' : 'Search'}
      </Button>
    </aside>
  )
}
