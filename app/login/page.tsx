/**
 * @route /login
 * @pattern 인증 - 로그인 페이지 (Client Component 단일 파일)
 * @description
 * NextAuth.js Credentials Provider를 사용한 로그인 페이지.
 * Oracle EMP 테이블의 USER_ID를 username으로, 고정 비밀번호로 간이 인증한다.
 * 인증 성공/이미 로그인 상태 모두 callbackUrl(없으면 '/')로 단일 경로로 이동한다.
 */
'use client'

import { useEffect, useState } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button, Input, Panel } from '@/components/control'
import RouteInfo from '@/components/shared/RouteInfo'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { status } = useSession()

  const raw = searchParams.get('callbackUrl') ?? ''
  const callbackUrl = raw.startsWith('/') && raw !== '/login' ? raw : '/A00001'

  const [username, setUsername] = useState('keunchul.jung')
  const [password, setPassword] = useState('password123')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // 인증되면 callbackUrl로 단일 이동. handleSubmit과 흐름을 통일해 중복 네비게이션 방지.
  useEffect(() => {
    if (status !== 'authenticated') return
    router.replace(callbackUrl)
  }, [status, router, callbackUrl])

  async function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('사원명(ENAME) 또는 비밀번호가 올바르지 않습니다.')
        setIsLoading(false)
      }
      // 성공 시: session status가 'authenticated'로 바뀌면 위 useEffect가 이동시킴.
      // isLoading은 그대로 두어 폼이 다시 활성화되며 깜빡이는 것을 막는다.
    } catch {
      setError('로그인 중 오류가 발생했습니다.')
      setIsLoading(false)
    }
  }

  // 인증된 유저는 redirect 진행 중이므로 폼을 렌더하지 않음 (플리커 최소화)
  if (status === 'authenticated') return null

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4">
      <Panel variant="elevated" className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-text-primary">로그인</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Oracle EMP 테이블의 사원명(ENAME)으로 로그인하세요
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="사원명 (ENAME)"
            type="text"
            placeholder="예: SMITH, JONES, KING"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />

          <Input
            label="비밀번호"
            type="password"
            placeholder="비밀번호를 입력하세요"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          {error && (
            <p className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isLoading}
            className="w-full"
          >
            로그인
          </Button>
        </form>

        <div className="mt-4 rounded-lg bg-bg-tertiary px-3 py-2 text-xs text-text-muted">
          <p className="font-medium">테스트 계정 안내</p>
          <p>사원명: SMITH, JONES, KING 등 EMP 테이블의 ENAME</p>
          <p>비밀번호: password123</p>
        </div>
      </Panel>

      <div className="mt-8 w-full max-w-md">
        <RouteInfo
          pattern="Authentication - Login"
          syntax="app/login/page.tsx"
          description="NextAuth v5 Credentials Provider로 Oracle EMP 테이블 기반 간이 인증을 구현한 페이지입니다. JWT 전략으로 15분 세션 유지 + sliding window 토큰 갱신을 적용합니다."
          docsUrl="https://authjs.dev/getting-started"
        />
      </div>
    </div>
  )
}
