/**
 * @module _instrumentation.ts
 * @description
 * Next.js 16 서버 계측(Instrumentation) 파일.
 * 파일명 앞의 `_`는 테스트 기간 동안 비활성화 상태를 의미한다.
 * 활성화하려면 파일명을 `instrumentation.ts`로 변경한다.
 *
 * ─────────────────────────────────────────────────────────────────────
 * 이 파일의 역할과 기존 에러 시스템과의 관계
 * ─────────────────────────────────────────────────────────────────────
 *
 * 프로젝트의 에러 처리 아키텍처는 이중 구조로 설계되었다:
 *
 * ■ lib/db/logger.ts (DbLogger)
 *   - DB 팩토리(withLifecycle)를 경유하는 모든 쿼리의 성공/실패를 기록
 *   - Server Action 내부에서 getDb()로 호출하는 모든 DB 작업이 대상
 *   - 비즈니스 로직 에러(제약 조건 위반, 타임아웃, 권한 등)를 분류·기록
 *
 * ■ instrumentation.ts (이 파일)
 *   - DbLogger가 **닿지 않는** 서버 에러를 잡는 최후의 안전망
 *   - DB 팩토리를 거치지 않거나, DB 자체에 문제가 있어 로깅이 불가능한 상황을 커버
 *
 * ─────────────────────────────────────────────────────────────────────
 * 이 파일이 잡는 에러 유형 (DbLogger가 커버하지 못하는 영역)
 * ─────────────────────────────────────────────────────────────────────
 *
 * 1. Server Component 렌더링 에러
 *    - DB에서 정상적으로 데이터를 가져온 후, JSX를 렌더링하는 도중 발생하는 에러
 *    - 예: data.user.name.toUpperCase() 에서 data.user가 null인 경우
 *    - DB 팩토리의 withLifecycle은 이미 성공적으로 완료된 후이므로 DbLogger에 남지 않음
 *
 * 2. proxy.ts (구 middleware.ts) 에러
 *    - proxy.ts는 Edge/Node 환경에서 라우팅 전에 실행됨
 *    - 인증 토큰 파싱, 리다이렉트 로직 등에서 발생하는 에러
 *    - DB 커넥션과 무관한 시점에서 실행되므로 DbLogger에 기록 불가
 *
 * 3. Route Handler (app/api/*) 에러
 *    - API 엔드포인트에서 DB를 사용하지 않는 로직(외부 API 통신, 파일 처리 등)의 에러
 *    - DB를 사용하더라도 getDb() 호출 전에 터지는 에러(파라미터 파싱 실패 등)
 *
 * 4. Server Action 자체의 부팅/초기화 에러
 *    - Server Action 함수가 호출되었으나, getDb() 호출 전에 발생하는 에러
 *    - 예: 입력값 변환, 타입 캐스팅, 외부 모듈 초기화 실패 등
 *
 * 5. DB 연결 자체가 불가능한 치명적 상황
 *    - DB 커넥션 풀 고갈, 네트워크 단절, DB 서버 다운 등
 *    - DbLogger가 DB에 INSERT를 시도해도 실패하는 상황
 *    - 이 경우 console.error와 파일 로그가 유일한 기록 수단
 *
 * 6. 스트리밍(Streaming/Suspense) 중 발생하는 에러
 *    - Server Component의 async 렌더링 중 Suspense 바운더리 밖에서 발생하는 에러
 *
 * ─────────────────────────────────────────────────────────────────────
 * 로깅 전략
 * ─────────────────────────────────────────────────────────────────────
 *
 * 1차: console.error — 서버 표준 에러 출력 (pm2, docker 로그 수집기 등이 캡처 가능)
 * 2차: 파일 로그 — DB가 불가능한 상황에서의 영구 기록 (주석 예시 참고)
 *
 * DB 로그 테이블 INSERT는 lib/db/logger.ts의 책임이므로 이 파일에서는 수행하지 않는다.
 * (중복 방지 원칙)
 */

// ─── register(): 서버 부팅 시 1회 실행 ─────────────────────────────
/**
 * Next.js 서버가 시작될 때 딱 한 번 호출된다.
 * Node.js 런타임과 Edge 런타임 각각에서 1회씩 실행될 수 있다.
 *
 * 용도:
 *  - 모니터링/관측 도구 초기화 (현재는 외부 도구 미사용)
 *  - 서버 시작 로그 기록
 *  - 환경별 분기 처리
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: 'info',
        scope: 'instrumentation',
        event: 'server.start',
        runtime: 'nodejs',
        nodeVersion: process.version,
        env: process.env.NODE_ENV,
      }),
    )
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: 'info',
        scope: 'instrumentation',
        event: 'server.start',
        runtime: 'edge',
        env: process.env.NODE_ENV,
      }),
    )
  }
}

// ─── onRequestError(): 서버 요청 처리 중 에러 캐치 ─────────────────
/**
 * 서버에서 요청을 처리하는 동안 발생한 모든 에러가 이 함수로 전달된다.
 * error.tsx / global-error.tsx 와 달리, 이 함수는 서버 측에서만 실행되며
 * 렌더링·라우트 핸들러·서버 액션·proxy 등 모든 서버 요청 유형을 커버한다.
 *
 * @param err     - 발생한 에러 객체
 * @param request - 요청 정보 (url, method, headers)
 * @param context - 라우팅 맥락 정보
 *   - routerKind: 'App Router' | 'Pages Router'
 *   - routePath: 에러가 발생한 라우트 경로 (예: '/blog/[slug]')
 *   - routeType: 에러 발생 단계
 *     - 'render'     → Server Component 렌더링 중
 *     - 'route'      → Route Handler (app/api/*) 실행 중
 *     - 'action'     → Server Action 실행 중
 *     - 'middleware'  → proxy.ts (구 middleware) 실행 중
 */
export async function onRequestError(
  err: Error,
  request: { url: string; method: string; headers: Record<string, string> },
  context: {
    routerKind: 'App Router' | 'Pages Router'
    routePath: string
    routeType: 'render' | 'route' | 'action' | 'middleware'
  },
) {
  // ── 1차 로깅: 구조화된 JSON 콘솔 출력 ──────────────────────────
  // pm2, docker, AWS CloudWatch 등 서버 로그 수집기가 stdout/stderr를 캡처한다.
  const logEntry = {
    ts: new Date().toISOString(),
    level: 'error',
    scope: 'instrumentation',
    event: 'server.request.error',
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
    url: request.url,
    method: request.method,
    errorName: err.name,
    errorMessage: err.message,
    // production에서는 err.stack이 마스킹될 수 있으나, 서버 로그에는 가능한 한 남긴다
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    // DbError 계열인 경우 추가 메타데이터 포함
    ...(isDbError(err)
      ? {
          dbErrorCategory: (err as DbErrorLike).category,
          dbErrorCode: (err as DbErrorLike).code,
          dbTraceId: (err as DbErrorLike).traceId,
          dbDevMessage: (err as DbErrorLike).devMessage,
        }
      : {}),
  }

  console.error(JSON.stringify(logEntry))

  // ── 2차 로깅: 파일 로그 (DB 불가 시 영구 기록) ──────────────────
  // DB 커넥션이 끊어져 DbLogger가 INSERT할 수 없는 치명적 상황에서,
  // 서버 로컬 디스크에 에러 로그 파일을 남긴다.
  //
  // 아래 주석을 활성화하면 D드라이브의 지정된 폴더에 일자별 로그 파일을 생성한다.
  // 운영 환경 배포 시 해당 폴더가 존재하는지, 쓰기 권한이 있는지 사전 확인 필요.
  //
  // import { appendFile, mkdir } from 'node:fs/promises'
  // import { join } from 'node:path'
  //
  // const LOG_DIR = 'D:/logs/my-app/server-errors'
  //
  // async function writeFileLog(entry: Record<string, unknown>): Promise<void> {
  //   try {
  //     // 일자별 폴더 생성 (예: D:/logs/my-app/server-errors/2026-04-13/)
  //     const dateStr = new Date().toISOString().slice(0, 10)
  //     const dirPath = join(LOG_DIR, dateStr)
  //     await mkdir(dirPath, { recursive: true })
  //
  //     // 시간 기반 파일명 (예: error_14-30-00_a1b2c3.json)
  //     const timeStr = new Date().toISOString().slice(11, 19).replace(/:/g, '-')
  //     const uniqueId = Math.random().toString(36).slice(2, 8)
  //     const filePath = join(dirPath, `error_${timeStr}_${uniqueId}.json`)
  //
  //     await appendFile(filePath, JSON.stringify(entry, null, 2) + '\n', 'utf-8')
  //   } catch (fileErr) {
  //     // 파일 로그마저 실패하면 콘솔이 최후의 수단
  //     console.error('[instrumentation] File log write failed:', fileErr)
  //   }
  // }
  //
  // await writeFileLog(logEntry)
}

// ─── DbError 식별 유틸리티 ──────────────────────────────────────────
/**
 * lib/db/errors.ts의 DbError를 직접 import하면 순환 의존 위험이 있으므로,
 * duck-typing으로 DbError 여부를 판별한다.
 */
interface DbErrorLike {
  name: string
  category: string
  code?: string
  traceId: string
  devMessage?: string
}

function isDbError(err: unknown): err is DbErrorLike {
  return (
    err instanceof Error &&
    err.name === 'DbError' &&
    'category' in err &&
    'traceId' in err
  )
}
