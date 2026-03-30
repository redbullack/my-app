/**
 * @route /(marketing)/*
 * @pattern Route Group — (group)
 * @description
 * (marketing) Route Group의 공유 레이아웃.
 * Route Group은 괄호로 감싼 폴더명으로, URL 경로에 포함되지 않는다.
 * 즉, /about, /pricing 등의 페이지가 이 레이아웃을 공유하지만
 * URL에는 /marketing이 나타나지 않는다.
 *
 * 용도: 동일한 레이아웃/스타일을 공유하는 페이지들을 논리적으로 그룹화한다.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-8 rounded-lg bg-accent/5 border border-accent/20 px-4 py-2">
        <p className="text-xs text-accent font-medium">
          📁 Route Group: (marketing) — 이 레이아웃은 about, pricing 페이지에 공유 적용됩니다
        </p>
      </div>
      {children}
    </div>
  )
}
