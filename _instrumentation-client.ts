// isolatedModules 환경에서 이 파일을 모듈로 인식시키기 위한 빈 export.
// instrumentation-client.ts는 Next.js가 자동 실행하므로 외부에서 import할 일은 없다.
export {}

/**
 * @module _instrumentation-client.ts
 * @description
 * Next.js 16 클라이언트 계측(Instrumentation) 파일.
 * 파일명 앞의 `_`는 테스트 기간 동안 비활성화 상태를 의미한다.
 * 활성화하려면 파일명을 `instrumentation-client.ts`로 변경한다.
 *
 * ─────────────────────────────────────────────────────────────────────
 * 이 파일의 역할과 기존 에러 시스템과의 관계
 * ─────────────────────────────────────────────────────────────────────
 *
 * 프로젝트의 클라이언트 에러 처리는 두 계층으로 나뉜다:
 *
 * ■ components/providers/GlobalErrorCatcher.tsx (ClientLogger 활용)
 *   - React 트리가 마운트된 이후의 런타임 에러를 캐치
 *   - window.error + unhandledrejection 이벤트 리스너 등록
 *   - ClientError 분류 체계(category, traceId, devMessage)를 온전히 활용
 *   - useEffect cleanup으로 리스너 해제 가능 (메모리 누수 방지)
 *   - React 컨텍스트 접근 가능 (로거 교체, 에러 분류 등)
 *
 * ■ instrumentation-client.ts (이 파일)
 *   - 클라이언트 번들이 로드되는 즉시, React 마운트 전에 실행
 *   - GlobalErrorCatcher가 아직 마운트되지 않은 초기 부팅 구간의 에러를 캐치
 *   - layout.tsx 자체가 크래시되어 GlobalErrorCatcher가 마운트되지 못하는 상황을 커버
 *
 * ─────────────────────────────────────────────────────────────────────
 * GlobalErrorCatcher.tsx와의 중복 방지 전략
 * ─────────────────────────────────────────────────────────────────────
 *
 * 이 파일과 GlobalErrorCatcher.tsx가 동시에 활성화되면,
 * 동일한 에러에 대해 window.error / unhandledrejection 이벤트가
 * 두 곳 모두에서 감지되어 중복 로깅이 발생한다.
 *
 * 이를 방지하기 위해 글로벌 플래그(__GLOBAL_ERROR_CATCHER_MOUNTED__)를 사용한다:
 *
 * 1. 이 파일: 번들 로드 즉시 이벤트 리스너를 등록한다.
 *    단, 리스너 내부에서 __GLOBAL_ERROR_CATCHER_MOUNTED__ 플래그를 확인하여,
 *    GlobalErrorCatcher가 이미 마운트된 상태라면 로깅을 건너뛴다.
 *    → React 트리가 정상 동작 중이면 GlobalErrorCatcher에게 처리를 위임
 *
 * 2. GlobalErrorCatcher.tsx: useEffect에서 마운트 시 플래그를 true로 설정하고,
 *    언마운트(cleanup) 시 false로 복원한다.
 *    → layout 크래시 등으로 언마운트되면 플래그가 false가 되어
 *       이 파일의 리스너가 자동으로 활성화됨
 *
 * 결과적으로:
 *  - React 마운트 전 구간: 이 파일이 에러를 캐치 (유일한 리스너)
 *  - React 정상 동작 중:   GlobalErrorCatcher가 에러를 캐치 (이 파일은 스킵)
 *  - layout 크래시 후:     이 파일이 다시 에러를 캐치 (GlobalErrorCatcher 언마운트됨)
 *
 * ─────────────────────────────────────────────────────────────────────
 * 이 파일이 잡는 에러 유형 (GlobalErrorCatcher가 커버하지 못하는 영역)
 * ─────────────────────────────────────────────────────────────────────
 *
 * 1. 번들 초기 로드 에러
 *    - JavaScript 모듈 파싱/실행 중 발생하는 에러
 *    - React, Next.js 런타임 자체의 초기화 실패
 *    - 예: import 경로 오류, 전역 변수 참조 에러 등
 *
 * 2. React 트리 마운트 실패
 *    - layout.tsx의 렌더링 자체가 실패하여 GlobalErrorCatcher가 마운트되지 못한 경우
 *    - ThemeProvider, AuthSessionProvider 등 Provider 초기화 실패
 *
 * 3. Hydration 불일치 에러 (onRecoverableError 영역)
 *    - 서버 HTML과 클라이언트 렌더링 결과가 달라 React가 DOM을 버리고 재렌더링한 경우
 *    - 앱은 살아남지만 성능 저하를 유발하므로 개발자에게 알려야 함
 *    - 주의: 이 에러는 React 내부에서 자동 복구되므로 window.error 이벤트로 잡히지 않음
 *      → 콘솔 경고만 발생하며, 완전한 추적은 Sentry 등 외부 도구가 필요
 *
 * ─────────────────────────────────────────────────────────────────────
 * 로깅 전략
 * ─────────────────────────────────────────────────────────────────────
 *
 * 현재: console.error로 구조화된 JSON 출력
 * 향후: Server Action을 통해 로그 테이블에 INSERT (주석 예시 참고)
 */

// ─── 글로벌 플래그 타입 선언 ─────────────────────────────────────────
declare global {
  interface Window {
    /**
     * GlobalErrorCatcher.tsx가 마운트되면 true, 언마운트되면 false.
     * 이 파일의 리스너는 이 플래그가 false일 때만 로깅을 수행한다.
     */
    __GLOBAL_ERROR_CATCHER_MOUNTED__?: boolean
  }
}

// ─── Server Action을 통한 DB 로그 저장 (향후 활성화) ──────────────────
//
// Server Action은 'use server' 파일에서 export된 async 함수를 import하여 호출한다.
// instrumentation-client.ts는 React 컴포넌트가 아니지만,
// Next.js 클라이언트 번들의 일부이므로 Server Action import가 가능하다.
//
// import { insertClientInstrumentationLog } from '@/actions/log'
//
// 사용 예시:
// async function sendLogToServer(payload: Record<string, unknown>): Promise<void> {
//   try {
//     await insertClientInstrumentationLog({
//       level: 'error',
//       scope: 'instrumentation-client',
//       ...payload,
//       ts: new Date().toISOString(),
//     })
//   } catch (sendErr) {
//     // Server Action 호출 실패 시 콘솔 fallback (네트워크 단절, 서버 다운 등)
//     console.warn('[instrumentation-client] Server log send failed:', sendErr)
//   }
// }

// ─── 에러 리스너 등록 ────────────────────────────────────────────────

/**
 * 동기 런타임 에러 캐치 (uncaught throw)
 * - try/catch로 잡히지 않은 에러가 window까지 전파되면 발생
 * - React 렌더링 에러는 Error Boundary(error.tsx)가 먼저 잡으므로 여기 도달하지 않음
 * - 주로 이벤트 핸들러, setTimeout 콜백 등에서 발생하는 에러를 캐치
 */
window.addEventListener('error', (event: ErrorEvent) => {
  // GlobalErrorCatcher가 이미 마운트되어 있으면 처리를 위임한다
  if (window.__GLOBAL_ERROR_CATCHER_MOUNTED__) return

  const logEntry = {
    ts: new Date().toISOString(),
    level: 'error',
    scope: 'instrumentation-client',
    event: 'client.uncaught.early',
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    errorName: event.error?.name,
    errorStack: event.error?.stack,
  }

  console.error(JSON.stringify(logEntry))

  // 향후 Server Action 전송:
  // void sendLogToServer(logEntry)
})

/**
 * 미처리 Promise rejection 캐치
 * - await 없이 호출된 async 함수, catch 없는 Promise 체인 등에서 발생
 * - React 18+ 에서는 이벤트 핸들러 내 async 에러도 이 이벤트로 전파됨
 */
window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  // GlobalErrorCatcher가 이미 마운트되어 있으면 처리를 위임한다
  if (window.__GLOBAL_ERROR_CATCHER_MOUNTED__) return

  const reason = event.reason
  const logEntry = {
    ts: new Date().toISOString(),
    level: 'error',
    scope: 'instrumentation-client',
    event: 'client.unhandledrejection.early',
    message: reason instanceof Error ? reason.message : String(reason),
    errorName: reason instanceof Error ? reason.name : undefined,
    errorStack: reason instanceof Error ? reason.stack : undefined,
  }

  console.error(JSON.stringify(logEntry))

  // 향후 Server Action 전송:
  // void sendLogToServer(logEntry)
})
