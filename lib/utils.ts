/**
 * @description 공통 유틸리티 함수
 */

/** 클래스명 결합 유틸리티 (clsx 대체) */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

/** 인위적 딜레이 (Suspense/streaming 데모용) */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** 날짜 포맷 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
