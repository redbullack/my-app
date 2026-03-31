/**
 * @route /docs/[[...slug]]
 * @pattern Client Component — Docs 본문 UI
 * @description
 * 서버에서 전달받은 데이터를 기반으로 Docs 페이지를 렌더링하는 클라이언트 컴포넌트.
 * 사이드바 토글(접기/펼치기) 상태를 useState로 관리한다.
 */
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DOCS_TREE } from '@/lib/constants'
import { Panel, Badge, Button } from '@/components/control'
import RouteInfo from '@/components/shared/RouteInfo'
import CodeBlock from '@/components/shared/CodeBlock'

interface DocsContentProps {
  currentSlug: string[]
  doc: (typeof DOCS_TREE)[number] | undefined
}

export default function DocsContent({ currentSlug, doc }: DocsContentProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold text-text-primary">Docs</h1>

      {/* 현재 경로 표시 */}
      <div className="mt-4 flex items-center gap-2 text-sm">
        <Link href="/docs" className="text-accent hover:underline">docs</Link>
        {currentSlug.map((seg, i) => (
          <span key={i} className="flex items-center gap-2">
            <span className="text-text-muted">/</span>
            <Link
              href={`/docs/${currentSlug.slice(0, i + 1).join('/')}`}
              className="text-accent hover:underline"
            >
              {seg}
            </Link>
          </span>
        ))}
      </div>

      {/* 사이드바 토글 버튼 */}
      <div className="mt-6">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setSidebarOpen(prev => !prev)}
        >
          {sidebarOpen ? '📂 사이드바 접기' : '📁 사이드바 펼치기'}
        </Button>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        {/* 사이드 네비게이션 — 토글 상태에 따라 표시 */}
        {sidebarOpen && (
          <Panel variant="outlined" className="lg:col-span-1">
            <h2 className="font-semibold text-text-primary mb-3">문서 목차</h2>
            <nav className="space-y-1">
              {DOCS_TREE.map(d => {
                const href = d.slug.length === 0 ? '/docs' : `/docs/${d.slug.join('/')}`
                const isActive = d.slug.join('/') === currentSlug.join('/')
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
                      isActive
                        ? 'bg-accent/10 text-accent font-medium'
                        : 'text-text-secondary hover:bg-bg-tertiary'
                    }`}
                    style={{ paddingLeft: `${(d.slug.length * 12) + 12}px` }}
                  >
                    {d.title}
                  </Link>
                )
              })}
            </nav>
          </Panel>
        )}

        {/* 본문 */}
        <div className={`space-y-4 ${sidebarOpen ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          {doc ? (
            <Panel variant="elevated">
              <Badge variant="info" className="mb-2">
                {currentSlug.length === 0 ? '루트' : currentSlug.join(' / ')}
              </Badge>
              <h2 className="text-xl font-bold text-text-primary">{doc.title}</h2>
              <p className="mt-2 text-text-secondary">{doc.content}</p>
            </Panel>
          ) : (
            <Panel variant="outlined">
              <p className="text-text-muted">해당 경로의 문서가 없습니다.</p>
            </Panel>
          )}

          <CodeBlock
            language="json"
            code={JSON.stringify({ slug: currentSlug.length ? currentSlug : undefined }, null, 2)}
          />
        </div>
      </div>

      <RouteInfo
        pattern="Optional Catch-all Segment"
        syntax="app/docs/[[...slug]]/page.tsx"
        description="[[...param]]은 세그먼트가 0개(루트 /docs)인 경우도 매칭됩니다. [...param]과 달리 루트 경로에서도 이 페이지가 렌더링됩니다."
        docsUrl="https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes#optional-catch-all-segments"
      />
    </div>
  )
}
