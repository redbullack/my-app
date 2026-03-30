/**
 * @component LoginForm
 * @description
 * 로그인 폼 Client Component. 기존 Input, Button, Panel 컨트롤을 재사용한다.
 * next-auth/react의 signIn()으로 Credentials 인증을 수행하고,
 * 성공 시 /dashboard로 리다이렉트, 실패 시 에러 메시지를 표시한다.
 */
'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button, Input, Panel } from '@/components/control'

export default function LoginForm() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
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
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch {
      setError('로그인 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
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
  )
}
