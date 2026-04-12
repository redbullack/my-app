/**
 * @route /
 * @pattern Root Layout
 * @description
 * 앱 전체에 적용되는 루트 레이아웃. html, body 태그를 정의하고,
 * ThemeProvider로 테마 시스템을, Header/Footer로 공통 UI를 제공한다.
 *
 * FOUC 방지: <head>에 인라인 스크립트를 삽입하여 페이지 로드 전에
 * localStorage의 테마 설정을 <html>에 적용한다.
 *
 * Next.js 16에서는 layout의 children 외에 @slot parallel route도 props로 받을 수 있다.
 * 이 루트 레이아웃에서는 @modal 슬롯을 받아 Intercepting Routes 모달을 렌더링한다.
 */
import type { Metadata } from 'next'
import './globals.css'
import ThemeProvider from '@/components/layout/ThemeProvider'
import AuthSessionProvider from '@/components/auth/SessionProvider'
import GlobalErrorCatcher from '@/components/providers/GlobalErrorCatcher'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

export const metadata: Metadata = {
  title: 'Next.js 16 App Router Lab',
  description: 'Next.js 16의 모든 App Router 기능을 학습하는 연습용 프레임워크',
}

/** FOUC 방지 스크립트: body 렌더 전에 테마 클래스 적용 */
const THEME_SCRIPT = `
(function(){
  try {
    var t = localStorage.getItem('theme');
    var dark = t === 'dark' || (!t || t === 'system') && window.matchMedia('(prefers-color-scheme:dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
  } catch(e){}
})()
`

export default function RootLayout({
  children,
  modal,
}: {
  children: React.ReactNode
  modal: React.ReactNode
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen flex flex-col bg-bg-primary text-text-primary">
        <AuthSessionProvider>
          <GlobalErrorCatcher>
            <ThemeProvider>
              <Header />
              <main className="flex-1">{children}</main>
              {modal}
              <Footer />
            </ThemeProvider>
          </GlobalErrorCatcher>
        </AuthSessionProvider>
      </body>
    </html>
  )
}
