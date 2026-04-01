/**
 * @component TabSub
 * @description
 * Tab 컴포넌트의 자식으로 사용되는 마커 컴포넌트.
 * label prop은 Tab이 탭 헤더 버튼을 렌더링할 때 사용한다.
 * 실제 렌더링은 children을 그대로 출력하며, Tab이 hidden 클래스로 가시성을 제어한다.
 */
import { cn } from '@/lib/utils'

interface TabSubProps {
  /** 탭 헤더에 표시될 라벨 */
  label: string
  className?: string
  children: React.ReactNode
}

export default function TabSub({ label: _label, className, children }: TabSubProps) {
  return (
    <div className={cn(className)}>
      {children}
    </div>
  )
}
