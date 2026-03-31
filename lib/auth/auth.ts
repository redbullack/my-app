/**
 * @module auth
 * @description
 * NextAuth v5 (Auth.js) 핵심 설정 파일.
 * Credentials Provider로 Oracle EMP 테이블 기반 간이 인증을 구현한다.
 * JWT 전략 사용, 15분 만료 + sliding window 방식 토큰 갱신.
 *
 * export: handlers (Route Handler용), auth (세션 조회), signIn, signOut
 */

import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { getDbClient } from '@/lib/db'
import type { Emp } from '@/types/emp'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: 'Username (ENAME)', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null

        // 고정 비밀번호 비교 (학습 목적)
        if (credentials.password !== process.env.EMP_LOGIN_PASSWORD) return null

        // Oracle EMP 테이블에서 ENAME 조회
        const username = (credentials.username as string).toUpperCase()
        const db = getDbClient()
        const rows = await db.query<Emp>(
          'SELECT EMPNO, ENAME, JOB FROM EMP WHERE ENAME = :username',
          [username],
        )

        if (rows.length === 0) return null

        const emp = rows[0]
        return {
          id: String(emp.EMPNO),
          name: emp.ENAME,
          role: emp.JOB,
          empno: emp.EMPNO,
        }
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 15 * 60, // 15분
  },

  pages: {
    signIn: '/login',
  },

  callbacks: {
    async jwt({ token, user }) {
      // 최초 로그인 시 사용자 정보를 토큰에 추가
      if (user) {
        token.role = user.role
        token.empno = user.empno
        token.issuedAt = Date.now()
      }

      // Sliding window 토큰 갱신: 발급 후 10분 경과 시 issuedAt 갱신
      // → maxAge(15분) 기준이 리셋되어 세션이 연장됨
      const issued = token.issuedAt as number | undefined
      if (issued && Date.now() - issued > 10 * 60 * 1000) {
        token.issuedAt = Date.now()
      }

      return token
    },

    async session({ session, token }) {
      session.user.id = token.sub!
      session.user.role = token.role as string
      session.user.empno = token.empno as number
      return session
    },
  },
})
