/**
 * @component Tab
 * @description
 * 탭 전환 UI 컴포넌트. TabSub 자식들의 label을 읽어 탭 헤더를 렌더링한다.
 * 모든 탭 콘텐츠는 항상 DOM에 마운트되며, hidden 클래스로 비활성 탭을 숨긴다.
 * 이를 통해 탭 전환 시 내부 상태가 리셋되지 않는다.
 *
 * - Uncontrolled 모드: defaultIndex로 초기 탭 설정, 내부 state로 관리
 * - Controlled 모드: activeIndex + onChangeIndex props로 외부에서 제어
 */
'use client'

import { useState, Children, isValidElement } from 'react'
import { cn } from '@/lib/utils'

interface TabProps {
  /** 초기 활성 탭 인덱스 (uncontrolled 모드) */
  defaultIndex?: number
  /** 활성 탭 인덱스 (controlled 모드) */
  activeIndex?: number
  /** 탭 변경 콜백 (controlled 모드) */
  onChangeIndex?: (index: number) => void
  className?: string
  children: React.ReactNode
}

export default function Tab({
  defaultIndex = 0,
  activeIndex: controlledIndex,
  onChangeIndex,
  className,
  children,
}: TabProps) {
  const [internalIndex, setInternalIndex] = useState(defaultIndex)

  const isControlled = controlledIndex !== undefined
  const currentIndex = isControlled ? controlledIndex : internalIndex

  const handleChange = (index: number) => {
    if (!isControlled) {
      setInternalIndex(index)
    }
    onChangeIndex?.(index)
  }

  // TabSub children에서 label 추출
  const tabs = Children.toArray(children).filter(isValidElement)
  const labels = tabs.map((child) => {
    const props = child.props as { label?: string }
    return props.label ?? ''
  })

  return (
    <div className={cn('w-full', className)}>
      {/* 탭 헤더 */}
      <div className="flex border-b border-border overflow-x-auto">
        {labels.map((label, index) => (
          <button
            key={index}
            type="button"
            onClick={() => handleChange(index)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              index === currentIndex
                ? 'border-b-2 border-accent text-accent'
                : 'text-text-muted hover:text-text-primary hover:bg-bg-tertiary',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 — 모든 탭이 항상 마운트됨 */}
      <div className="pt-4">
        {tabs.map((child, index) => (
          <div
            key={index}
            className={index === currentIndex ? 'block' : 'hidden'}
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  )
}
