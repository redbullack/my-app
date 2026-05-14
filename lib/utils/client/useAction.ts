/**
 * @module lib/utils/client/useAction
 * @description
 * 이벤트 핸들러용 Server Action 실행 훅.
 *
 * 흐름 전제:
 *  - DB(lib/db/factory) 에서 발생한 에러는 가공 없이 throw 되어 ServerAction → Client 로 올라온다.
 *  - 프로덕션에서는 ServerAction throw 의 메시지가 마스킹되고 digest 만 남는다는 것을 기본 전제로 한다.
 *  - 이 훅은 마지막 그물 역할: redirect/notFound 는 Next 런타임에 위임, 그 외는 분류 후 alert.
 *
 * 사용 패턴:
 *   const { executeAction, isLoading, isError, error } = useAction<Emp[]>()
 *
 *   const onClick = async () => {
 *     const rows = await executeAction(() => fetchEmps())
 *     if (!rows) return                  // 실패 시 null — 훅이 alert 처리 완료
 *     setRows(rows)
 *   }
 *
 * TODO: PM 이 Toast 공용 컨트롤을 도입한 뒤 alert 호출 부분을 toast 로 교체.
 */
'use client'

import { useCallback, useState } from 'react'

export type ErrorKind = 'network' | 'aborted' | 'server' | 'unknown'

// ─── 에러 식별 헬퍼 ─────────────────────────────────────────────────
// next/dist 내부 경로의 isRedirectError/isNotFoundError 는 비공식 API 라
// Next 버전 업 시 깨지기 쉽다. digest 문자열 직접 검사로 안전성 확보.

function getDigest(err: unknown): string | undefined {
  if (err == null || typeof err !== 'object') return undefined
  const d = (err as { digest?: unknown }).digest
  return typeof d === 'string' ? d : undefined
}

function isNextRedirect(err: unknown): boolean {
  return getDigest(err)?.startsWith('NEXT_REDIRECT') ?? false
}

function isNextNotFound(err: unknown): boolean {
  return getDigest(err)?.startsWith('NEXT_NOT_FOUND') ?? false
}

function classifyError(err: unknown): { kind: ErrorKind; message: string } {
  // 사용자가 페이지를 떠나거나 AbortController 가 발동된 경우 — 조용히 무시
  if (err instanceof DOMException && err.name === 'AbortError') {
    return { kind: 'aborted', message: '' }
  }
  // 네트워크 단절/서버 다운/CORS 등. 메시지 문구는 브라우저별로 미세하게 달라 느슨하게 매칭.
  if (err instanceof TypeError && /fetch|network/i.test(err.message)) {
    return {
      kind: 'network',
      message: '서버와 통신할 수 없습니다. 네트워크 상태를 확인해주세요.',
    }
  }
  // digest 가 붙은 에러는 ServerAction 측에서 throw 된 것 (prod 에서 메시지 마스킹됨).
  // DB throw 포함한 거의 모든 서버 측 에러가 여기로 떨어진다.
  if (getDigest(err)) {
    return {
      kind: 'server',
      message: '서버 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    }
  }
  return { kind: 'unknown', message: '처리 중 오류가 발생했습니다.' }
}

interface ExecuteOptions {
  /** true 면 실패 시 alert 를 띄우지 않는다. 상태(isError/error) 는 그대로 채워진다. */
  silent?: boolean
}

export function useAction<T = unknown>() {
  const [isLoading, setIsLoading] = useState(false)
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null)
  const [data, setData] = useState<T | null>(null)

  const reset = useCallback(() => {
    setIsError(false)
    setError(null)
    setErrorKind(null)
  }, [])

  const executeAction = useCallback(
    async <R = T>(
      factory: () => Promise<R>,
      opts: ExecuteOptions = {},
    ): Promise<R | null> => {
      setIsLoading(true)
      setIsError(false)
      setError(null)
      setErrorKind(null)

      try {
        const result = await factory()
        setData(result as unknown as T)
        return result
      } catch (err: unknown) {
        // redirect/notFound 는 에러가 아니라 정상 네비게이션 — Next 런타임으로 rethrow.
        if (isNextRedirect(err) || isNextNotFound(err)) throw err

        const { kind, message } = classifyError(err)
        console.error('[useAction]', { kind, digest: getDigest(err), err })

        setIsError(true)
        setErrorKind(kind)
        setError(message)

        if (!opts.silent && kind !== 'aborted') {
          alert(message)
        }
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  return { executeAction, isLoading, isError, error, errorKind, data, reset }
}
