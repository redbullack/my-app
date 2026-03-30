/**
 * @description NextAuth v5 타입 확장.
 * User, Session, JWT에 커스텀 필드(role, empno)를 추가한다.
 */

import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface User {
    role?: string
    empno?: number
  }

  interface Session {
    user: {
      id: string
      name: string
      role: string
      empno: number
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string
    empno?: number
    issuedAt?: number
  }
}
