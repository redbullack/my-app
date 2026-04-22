/**
 * @module instrumentation.ts
 * @description
 * Next.js 16 서버 계측(Instrumentation) 엔트리.
 *
 * Next.js는 이 파일을 Node 런타임과 Edge 런타임 양쪽으로 번들링하므로,
 * Node 전용 API(process.exit, process.version 등)를 이 파일에 직접 작성하면
 * Edge 번들러가 정적 분석 경고를 발생시킨다.
 *
 * 해결책: Node 전용 로직은 `instrumentation-node.ts`에 분리하고,
 * 여기서는 런타임 체크 후 **동적 import**로만 로드한다.
 * 이렇게 하면 Edge 번들에는 동적 import 구문만 남고 Node API는 포함되지 않는다.
 *
 * ─────────────────────────────────────────────────────────────────────
 * 이 파일의 역할과 기존 에러 시스템과의 관계
 * ─────────────────────────────────────────────────────────────────────
 *
 * 프로젝트의 에러 처리 아키텍처는 이중 구조로 설계되었다:
 *
 * ■ lib/db/logger.ts (DbLogger)
 *   - DB 팩토리(withLifecycle)를 경유하는 모든 쿼리의 성공/실패를 기록
 *
 * ■ instrumentation.ts (이 파일) / instrumentation-node.ts
 *   - DbLogger가 닿지 않는 서버 에러를 잡는 최후의 안전망
 *   - 서버 부팅 시 DB 풀 워밍업(warmupDb) 수행
 *
 * 자세한 설명과 onRequestError 훅 예시는 instrumentation-node.ts 및 Git 히스토리 참조.
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { registerNode } = await import('./instrumentation-node')
  await registerNode()
}
