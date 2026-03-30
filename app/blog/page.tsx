/**
 * @route /blog
 * @pattern 정적 라우트 (블로그 목록)
 * @description
 * 블로그 목록 페이지. Server Component에서 async/await으로 데이터를 페칭한다.
 * 각 포스트는 /blog/[slug] 동적 세그먼트로 링크된다.
 */
import Link from 'next/link'
import { getPosts } from '@/actions/posts'
import { Panel, Badge } from '@/components/control'
import RouteInfo from '@/components/shared/RouteInfo'
import { formatDate } from '@/lib/utils'

export default async function BlogListPage() {
  const posts = await getPosts()

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold text-text-primary">Blog</h1>
      <p className="mt-2 text-text-secondary">
        각 글을 클릭하면 동적 세그먼트 [slug] 페이지로 이동합니다.
      </p>

      <div className="mt-8 space-y-4">
        {posts.map(post => (
          <Link key={post.slug} href={`/blog/${post.slug}`}>
            <Panel variant="outlined" className="hover:border-accent/50 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="info">{post.slug}</Badge>
                <span className="text-xs text-text-muted">{formatDate(post.date)}</span>
              </div>
              <h2 className="text-lg font-semibold text-text-primary">{post.title}</h2>
              <p className="mt-1 text-sm text-text-secondary">{post.excerpt}</p>
            </Panel>
          </Link>
        ))}
      </div>

      <RouteInfo
        pattern="Static Route"
        syntax="app/blog/page.tsx"
        description="블로그 목록 페이지. Server Component에서 데이터를 페칭하여 렌더링합니다."
        docsUrl="https://nextjs.org/docs/app/building-your-application/routing/pages"
      />
    </div>
  )
}
