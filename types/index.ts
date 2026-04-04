/**
 * @description 프로젝트 전역 TypeScript 타입 정의
 * 모든 공통 타입을 이 파일에서 관리하고 re-export 한다.
 */

/** 테마 모드 */
export type ThemeMode = 'light' | 'dark' | 'system'

/** 컨트롤 사이즈 */
export type Size = 'sm' | 'md' | 'lg'

/** Button variant */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

/** Panel variant */
export type PanelVariant = 'default' | 'outlined' | 'elevated'

/** Badge variant */
export type BadgeVariant = 'info' | 'success' | 'warning' | 'error'

/** Select 옵션 */
export interface SelectOption {
  value: string
  label: string
}

/** 블로그 포스트 */
export interface Post {
  slug: string
  title: string
  content: string
  date: string
  excerpt: string
}

/** RouteInfo 컴포넌트 props */
export interface RouteInfoProps {
  pattern: string
  syntax: string
  description: string
  docsUrl?: string
}

/** 네비게이션 아이템 */
export interface NavItem {
  label: string
  href: string
  description?: string
}

/** CompGrid 컬럼 설정 */
export interface GridColumn {
  key: string
  label: string
  width: string
  align?: 'left' | 'right' | 'center'
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode
}
