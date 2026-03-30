/**
 * @route /login
 * @pattern 인증 - 로그인 페이지
 * @description
 * NextAuth.js Credentials Provider를 사용한 로그인 페이지.
 * Oracle EMP 테이블의 ENAME을 username으로, 고정 비밀번호로 간이 인증한다.
 * Server Component로 렌더링하고, 폼은 Client Component(LoginForm)로 분리한다.
 */

import LoginForm from './LoginForm'
import RouteInfo from '@/components/shared/RouteInfo'

export default function LoginPage() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4">
      <LoginForm />

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
