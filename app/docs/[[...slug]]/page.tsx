/**
 * @route /docs, /docs/*, /docs/a/b/...
 * @pattern Optional Catch-all Segment ([[...param]])
 * @description
 * Optional Catch-all은 [...param]과 동일하되, 세그먼트가 0개인 경우(루트)도 매칭된다.
 * 예:
 *   /docs          → params.slug = undefined (또는 빈 배열)
 *   /docs/routing   → params.slug = ['routing']
 *   /docs/routing/dynamic-routes → params.slug = ['routing', 'dynamic-routes']
 *
 * Next.js 16: params는 Promise — await 필수. slug는 string[] | undefined.
 *
 * 이 파일은 Server Component로서 params를 await한 뒤,
 * 상태 관리가 필요한 UI는 Client Component(DocsContent)에 위임한다.
 */
import { DOCS_TREE } from '@/lib/constants'
import DocsContent from './DocsContent'

export default async function DocsPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>
}) {
  const { slug } = await params
  const currentSlug = slug ?? []

  // 현재 경로에 매칭되는 문서 찾기
  const doc = DOCS_TREE.find(
    d => d.slug.join('/') === currentSlug.join('/')
  )

  return <DocsContent currentSlug={currentSlug} doc={doc} />
}

// =============================================================================
// [비교용 원본] 리팩토링 전 단일 Server Component 구조
// 상태 관리 없이 page.tsx 하나로 UI까지 모두 처리하던 버전
// =============================================================================
//
// import Link from 'next/link'
// import { DOCS_TREE } from '@/lib/constants'
// import { Panel, Badge } from '@/components/control'
// import RouteInfo from '@/components/shared/RouteInfo'
// import CodeBlock from '@/components/shared/CodeBlock'
//
// export default async function DocsPage({
//   params,
// }: {
//   params: Promise<{ slug?: string[] }>
// }) {
//   const { slug } = await params
//   const currentSlug = slug ?? []
//
//   // 현재 경로에 매칭되는 문서 찾기
//   const doc = DOCS_TREE.find(
//     d => d.slug.join('/') === currentSlug.join('/')
//   )
//
//   return (
//     <div className="mx-auto max-w-4xl px-4 py-12">
//       <h1 className="text-3xl font-bold text-text-primary">Docs</h1>
//
//       {/* 현재 경로 표시 */}
//       <div className="mt-4 flex items-center gap-2 text-sm">
//         <Link href="/docs" className="text-accent hover:underline">docs</Link>
//         {currentSlug.map((seg, i) => (
//           <span key={i} className="flex items-center gap-2">
//             <span className="text-text-muted">/</span>
//             <Link
//               href={`/docs/${currentSlug.slice(0, i + 1).join('/')}`}
//               className="text-accent hover:underline"
//             >
//               {seg}
//             </Link>
//           </span>
//         ))}
//       </div>
//
//       <div className="mt-8 grid gap-6 lg:grid-cols-3">
//         {/* 사이드 네비게이션 */}
//         <Panel variant="outlined" className="lg:col-span-1">
//           <h2 className="font-semibold text-text-primary mb-3">문서 목차</h2>
//           <nav className="space-y-1">
//             {DOCS_TREE.map(d => {
//               const href = d.slug.length === 0 ? '/docs' : `/docs/${d.slug.join('/')}`
//               const isActive = d.slug.join('/') === currentSlug.join('/')
//               return (
//                 <Link
//                   key={href}
//                   href={href}
//                   className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
//                     isActive
//                       ? 'bg-accent/10 text-accent font-medium'
//                       : 'text-text-secondary hover:bg-bg-tertiary'
//                   }`}
//                   style={{ paddingLeft: `${(d.slug.length * 12) + 12}px` }}
//                 >
//                   {d.title}
//                 </Link>
//               )
//             })}
//           </nav>
//         </Panel>
//
//         {/* 본문 */}
//         <div className="lg:col-span-2 space-y-4">
//           {doc ? (
//             <Panel variant="elevated">
//               <Badge variant="info" className="mb-2">
//                 {currentSlug.length === 0 ? '루트' : currentSlug.join(' / ')}
//               </Badge>
//               <h2 className="text-xl font-bold text-text-primary">{doc.title}</h2>
//               <p className="mt-2 text-text-secondary">{doc.content}</p>
//             </Panel>
//           ) : (
//             <Panel variant="outlined">
//               <p className="text-text-muted">해당 경로의 문서가 없습니다.</p>
//             </Panel>
//           )}
//
//           <CodeBlock
//             language="json"
//             code={JSON.stringify({ slug: currentSlug.length ? currentSlug : undefined }, null, 2)}
//           />
//         </div>
//       </div>
//
//       <RouteInfo
//         pattern="Optional Catch-all Segment"
//         syntax="app/docs/[[...slug]]/page.tsx"
//         description="[[...param]]은 세그먼트가 0개(루트 /docs)인 경우도 매칭됩니다. [...param]과 달리 루트 경로에서도 이 페이지가 렌더링됩니다."
//         docsUrl="https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes#optional-catch-all-segments"
//       />
//     </div>
//   )
// }
