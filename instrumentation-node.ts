/**
 * @module instrumentation-node.ts
 * @description
 * Node.js 런타임 전용 계측 로직.
 * instrumentation.ts에서 동적 import로만 로드되므로 Edge 번들에 포함되지 않는다.
 * (process.exit, process.version 등 Node 전용 API를 안전하게 사용 가능)
 */

export async function registerNode(): Promise<void> {
  const startedAt = Date.now()
  const log = (
    level: 'info' | 'error',
    event: string,
    extra: Record<string, unknown> = {},
  ): void => {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      scope: 'instrumentation',
      event,
      runtime: 'nodejs',
      ...extra,
    })
    if (level === 'error') console.error(line)
    else console.log(line)
  }

  log('info', 'server.start', {
    nodeVersion: process.version,
    env: process.env.NODE_ENV,
  })

  const criticalDbs = ['MAIN'] as const

  try {
    const { warmupDb } = await import('@/lib/db/factory-new')

    await Promise.all(
      criticalDbs.map(async (name) => {
        const t0 = Date.now()
        await warmupDb(name)
        log('info', 'db.pool.ready', { db: name, elapsedMs: Date.now() - t0 })
      }),
    )

    log('info', 'server.ready', { elapsedMs: Date.now() - startedAt })
  } catch (err) {
    const e = err as Error
    log('error', 'server.boot.failed', {
      elapsedMs: Date.now() - startedAt,
      errorName: e?.name,
      errorMessage: e?.message,
      stack: process.env.NODE_ENV === 'development' ? e?.stack : undefined,
    })
    // 필수 DB 풀 초기화 실패는 부팅 차단 — PM2/k8s 가 재시작 백오프를 적용한다
    process.exit(1)
  }
}
