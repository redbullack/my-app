/**
 * @component CodeBlock
 * @description
 * 코드 스니펫을 보기 좋게 표시하는 컴포넌트.
 * 라이트/다크 테마에 맞는 배경색과 텍스트 색상을 사용한다.
 * 언어 라벨을 선택적으로 표시할 수 있다.
 */
interface CodeBlockProps {
  code: string
  language?: string
}

export default function CodeBlock({ code, language }: CodeBlockProps) {
  return (
    <div className="relative rounded-lg border border-border bg-bg-tertiary overflow-hidden">
      {language && (
        <div className="border-b border-border bg-bg-secondary px-4 py-1.5">
          <span className="text-xs font-medium text-text-muted">{language}</span>
        </div>
      )}
      <pre className="overflow-x-auto p-4">
        <code className="text-sm font-mono text-text-primary">{code}</code>
      </pre>
    </div>
  )
}
