/**
 * @description NextAuth v5 타입 확장.
 * User, Session, JWT에 커스텀 필드(role, empno)를 추가한다.
 *
 * [SSO 전환 시 참고]
 * OIDC Provider 사용 시 IdP에서 전달하는 프로필 정보에 맞춰
 * 아래 인터페이스를 확장한다. 주석 처리된 필드들은 SSO 도입 시
 * 필요에 따라 활성화하면 된다.
 */

import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface User {
    userId: string
    userName: string
    hasKrFlag: string
    hasJpFlag: string
    hasCnFlag: string
  }

  interface Session {
    user: {
        userId: string
        userName: string
        hasKrFlag: string
        hasJpFlag: string
        hasCnFlag: string
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string
    userName: string
    hasKrFlag: string
    hasJpFlag: string
    hasCnFlag: string
    issuedAt?: number
  }
}
