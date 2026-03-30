/**
 * @component AuthSessionProvider
 * @description
 * next-auth/react의 SessionProvider를 래핑하는 Client Component.
 * Root Layout(Server Component)에서 사용하기 위해 'use client' 경계를 분리한다.
 */
'use client'

import { SessionProvider } from 'next-auth/react'

export default function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
