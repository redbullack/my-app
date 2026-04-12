/**
 * @module lib/errors/client-logger
 * @description
 * 클라이언트 레이어 전용 구조화 로거.
 * lib/db/logger.ts 의 DbLogger 와 동일한 인터페이스 설계를 따른다.
 * 후일 서버 API 호출(DB 저장) 또는 Sentry/Datadog 로 무중단 교체 가능.
 *
 * 현재 구현: ConsoleClientLogger — JSON 한 줄 형태로 콘솔에 출력.
 */

export interface ClientLogger {
  info(event: string, fields: Record<string, unknown>): void
  warn(event: string, fields: Record<string, unknown>): void
  error(event: string, fields: Record<string, unknown>): void
}

/** 한 줄 JSON 형태로 콘솔에 출력하는 기본 구현. */
class ConsoleClientLogger implements ClientLogger {
  info(event: string, fields: Record<string, unknown>): void {
    this.write('info', event, fields)
  }
  warn(event: string, fields: Record<string, unknown>): void {
    this.write('warn', event, fields)
  }
  error(event: string, fields: Record<string, unknown>): void {
    this.write('error', event, fields)
  }

  private write(level: 'info' | 'warn' | 'error', event: string, fields: Record<string, unknown>) {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      scope: 'client',
      event,
      ...fields,
    })
    if (level === 'error') console.error(line)
    else if (level === 'warn') console.warn(line)
    else console.log(line)
  }
}

/**
 * 운영 환경용 서버 전송 구현체 (예시, 향후 활성화).
 *
 * 사용법:
 *  - 앱 부트 시점에 아래처럼 교체한다.
 *      import { setClientLogger } from '@/lib/errors/client-logger'
 *      setClientLogger(new ApiClientLogger())
 *
 * 주의:
 *  - 네트워크 전송 실패는 console.warn 으로만 남기고 원래 흐름에 영향을 주지 않는다.
 *  - 배치 전송(버퍼링 후 일괄 전송) 구현 시 페이지 언로드 전 flush 필요 (sendBeacon 활용).
 */
// class ApiClientLogger implements ClientLogger {
//   info(event: string, fields: Record<string, unknown>): void {
//     void this.#send('INFO', event, fields)
//   }
//   warn(event: string, fields: Record<string, unknown>): void {
//     void this.#send('WARN', event, fields)
//   }
//   error(event: string, fields: Record<string, unknown>): void {
//     void this.#send('ERROR', event, fields)
//   }
//
//   async #send(level: string, event: string, fields: Record<string, unknown>): Promise<void> {
//     try {
//       await fetch('/api/client-log', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ level, event, ...fields, ts: new Date().toISOString() }),
//       })
//     } catch (logErr) {
//       console.warn('[client.log.send.failed]', logErr)
//     }
//   }
// }

/** 모듈 단일 로거 인스턴스. 교체가 필요하면 setClientLogger() 사용. */
let logger: ClientLogger = new ConsoleClientLogger()

export function getClientLogger(): ClientLogger {
  return logger
}

export function setClientLogger(next: ClientLogger): void {
  logger = next
}
