/**
 * @route /blog/[slug]
 * @pattern Dynamic Segment ([param])
 * @description
 * 동적 세그먼트 패턴. URL의 [slug] 부분이 params.slug로 전달된다.
 * generateStaticParams()를 사용하면 빌드 타임에 정적 생성(SSG)이 가능하다.
 *
 * Next.js 16 변경사항:
 * - params는 Promise 타입 → 반드시 await 해야 한다.
 * - generateStaticParams()로 미리 알려진 경로는 빌드 시 사전 렌더링된다.
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPostBySlug, getPosts } from '@/actions/posts'
import { Panel, Badge, Button } from '@/components/control'
import RouteInfo from '@/components/shared/RouteInfo'
import CodeBlock from '@/components/shared/CodeBlock'
import { formatDate } from '@/lib/utils'

/** 빌드 타임에 정적 생성할 slug 목록 반환 (SSG) */
export async function generateStaticParams() {
  const posts = await getPosts()
  return posts.map(post => ({ slug: post.slug }))
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = await getPostBySlug(slug)

  if (!post) notFound()

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/blog" className="text-sm text-accent hover:underline">
        ← 블로그 목록
      </Link>

      <article className="mt-6">
        <div className="flex items-center gap-2 mb-4">
          <Badge variant="success">[slug] = &quot;{slug}&quot;</Badge>
          <span className="text-sm text-text-muted">{formatDate(post.date)}</span>
        </div>
        <h1 className="text-3xl font-bold text-text-primary">{post.title}</h1>
        <Panel variant="default" className="mt-6">
          <p className="text-text-secondary leading-relaxed">{post.content}</p>
        </Panel>
      </article>

      <div className="mt-8">
        <h3 className="text-sm font-semibold text-text-primary mb-2">이 페이지의 params:</h3>
        <CodeBlock language="json" code={JSON.stringify({ slug }, null, 2)} />
      </div>

      <RouteInfo
        pattern="Dynamic Segment"
        syntax="app/blog/[slug]/page.tsx"
        description="URL의 동적 부분을 params.slug로 받아 사용하는 패턴입니다. generateStaticParams()를 통해 빌드 시 정적 생성이 가능합니다."
        docsUrl="https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes"
      />
    </div>
  )
}
