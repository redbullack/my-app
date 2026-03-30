/**
 * @component Footer
 * @description
 * 전역 푸터. 프로젝트 정보와 참고 링크를 표시한다.
 * Server Component로 충분하므로 'use client' 없이 작성한다.
 */
export default function Footer() {
  return (
    <footer className="border-t border-border bg-bg-secondary">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-6 text-sm text-text-muted sm:flex-row sm:justify-between">
        <p>Next.js 16 App Router Practice Framework</p>
        <div className="flex gap-4">
          <a
            href="https://nextjs.org/docs/app"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent transition-colors"
          >
            Next.js Docs
          </a>
          <a
            href="https://tailwindcss.com/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent transition-colors"
          >
            TailwindCSS
          </a>
          <a
            href="https://react.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent transition-colors"
          >
            React 19
          </a>
        </div>
      </div>
    </footer>
  )
}
