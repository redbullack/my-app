/**
 * @component RouteInfo
 * @description
 * 현재 페이지의 라우팅 패턴 정보를 시각적으로 표시하는 학습용 컴포넌트.
 * 모든 예제 페이지 하단에 배치하여 해당 페이지가 어떤 라우팅 패턴을 사용하는지 보여준다.
 */
import type { RouteInfoProps } from '@/types'
import { Badge } from '@/components/control'

export default function RouteInfo({ pattern, syntax, description, docsUrl }: RouteInfoProps) {
  return (
    <div className="mt-8 rounded-xl border border-border bg-bg-secondary p-5">
      <div className="mb-3 flex items-center gap-2">
        <Badge variant="info">Routing Pattern</Badge>
        <span className="text-sm font-semibold text-text-primary">{pattern}</span>
      </div>
      <div className="space-y-2 text-sm">
        <p>
          <span className="font-medium text-text-secondary">파일 경로: </span>
          <code className="rounded bg-bg-tertiary px-1.5 py-0.5 font-mono text-xs text-accent">
            {syntax}
          </code>
        </p>
        <p className="text-text-secondary">{description}</p>
        {docsUrl && (
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-accent hover:underline"
          >
            공식 문서 →
          </a>
        )}
      </div>
    </div>
  )
}
