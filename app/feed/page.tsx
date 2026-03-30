/**
 * @route /feed
 * @pattern Parallel Routes — 메인 페이지 (children 슬롯)
 * @description
 * Feed 레이아웃의 children 영역. Parallel Routes에서 children은
 * 암묵적(implicit) 슬롯으로, page.tsx가 이 역할을 한다.
 * @feed, @stories 슬롯과 함께 동시에 렌더링된다.
 */
import { Badge } from '@/components/control'
import RouteInfo from '@/components/shared/RouteInfo'
import CodeBlock from '@/components/shared/CodeBlock'

export default function FeedPage() {
  return (
    <>
      <h1 className="text-3xl font-bold text-text-primary">Feed</h1>
      <p className="mt-2 text-text-secondary">
        이 페이지는 <Badge variant="info">@feed</Badge>와{' '}
        <Badge variant="success">@stories</Badge> 두 Parallel Route 슬롯을 동시에 렌더링합니다.
      </p>

      <div className="mt-4">
        <CodeBlock
          language="text"
          code={`app/feed/
├── layout.tsx      ← { children, feed, stories } 3개 슬롯 수신
├── page.tsx        ← children (이 파일)
├── @feed/
│   ├── page.tsx    ← feed 슬롯
│   └── default.tsx ← fallback
└── @stories/
    ├── page.tsx    ← stories 슬롯
    └── default.tsx ← fallback`}
        />
      </div>

      <RouteInfo
        pattern="Parallel Routes"
        syntax="app/feed/layout.tsx + @feed/ + @stories/"
        description="@폴더명으로 슬롯을 정의하면 layout이 여러 슬롯을 동시에 렌더링할 수 있습니다. 독립적 로딩/에러 처리가 가능합니다."
        docsUrl="https://nextjs.org/docs/app/building-your-application/routing/parallel-routes"
      />
    </>
  )
}
