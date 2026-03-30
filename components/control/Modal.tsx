/**
 * @component Modal
 * @description
 * 오버레이 배경 위에 중앙 정렬된 모달 다이얼로그.
 * isOpen으로 표시/숨김을 제어하고, onClose로 닫기 동작을 처리한다.
 * 다크 모드에서 오버레이와 모달 배경이 적절히 대응한다.
 * 오버레이 클릭 시 닫기, ESC 키 닫기를 지원한다.
 */
'use client'

import { useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  className?: string
  children: React.ReactNode
}

export default function Modal({ isOpen, onClose, title, className, children }: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    if (!isOpen) return
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 오버레이 */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      {/* 모달 본체 */}
      <div
        className={cn(
          'relative z-10 w-full max-w-md rounded-xl border border-border bg-bg-primary p-6 shadow-xl',
          className,
        )}
      >
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-text-muted hover:bg-bg-tertiary hover:text-text-primary transition-colors"
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
