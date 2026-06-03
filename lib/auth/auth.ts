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
import type { Emp } from '@/types/emp'
import { getDb } from '../db/db-new2'
// import { getDb } from '@/lib/db/db'


/**
 * ──────────────────────────────────────────────────────────────
 * [SSO 전환 시 참고] 사내 SSO(OIDC/SAML) Provider 예시
 * ──────────────────────────────────────────────────────────────
 *
 * NextAuth는 Credentials 외에 OIDC(OpenID Connect) Provider를 기본 지원한다.
 * 사내 SSO(Azure AD, Okta, Keycloak 등)를 사용할 경우 Credentials 대신
 * 아래와 같이 교체하면 된다.
 *
 * ── 예시 1: Azure AD (Entra ID) ──
 *
 * import AzureAD from 'next-auth/providers/azure-ad'
 *
 * providers: [
 *   AzureAD({
 *     clientId: process.env.AZURE_AD_CLIENT_ID!,
 *     clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
 *     tenantId: process.env.AZURE_AD_TENANT_ID!,
 *     // authorization: { params: { scope: 'openid profile email User.Read' } },
 *   }),
 * ]
 *
 * ── 예시 2: Okta ──
 *
 * import Okta from 'next-auth/providers/okta'
 *
 * providers: [
 *   Okta({
 *     clientId: process.env.OKTA_CLIENT_ID!,
 *     clientSecret: process.env.OKTA_CLIENT_SECRET!,
 *     issuer: process.env.OKTA_ISSUER!,   // e.g. https://your-org.okta.com/oauth2/default
 *   }),
 * ]
 *
 * ── 예시 3: 범용 OIDC (Keycloak, 자체 구축 IdP 등) ──
 *
 * providers: [
 *   {
 *     id: 'corporate-sso',
 *     name: 'Corporate SSO',
 *     type: 'oidc',
 *     issuer: process.env.SSO_ISSUER_URL!,
 *     clientId: process.env.SSO_CLIENT_ID!,
 *     clientSecret: process.env.SSO_CLIENT_SECRET!,
 *   },
 * ]
 *
 * SSO 사용 시 authorize() 대신 OIDC 콜백으로 사용자 정보가 자동 전달되며,
 * jwt callback의 `account` 파라미터에서 access_token, id_token 등을 받을 수 있다.
 * ──────────────────────────────────────────────────────────────
 */

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

        /**
         * [SSO 전환 시] authorize() 함수 자체가 불필요해진다.
         * OIDC Provider는 IdP가 인증을 처리하고, 콜백으로 profile 정보를 전달한다.
         * 아래 DB 조회 로직은 jwt callback의 signIn 이벤트나
         * events.signIn 에서 수행하여 사내 DB와 동기화할 수 있다.
         *
         * 예시 (jwt callback 내):
         *   if (account?.provider === 'corporate-sso') {
         *     const ssoUser = await db.query(
         *       'SELECT EMPNO, ENAME, JOB, DEPTNO FROM EMP WHERE EMAIL = :email',
         *       [profile.email],
         *     )
         *     token.empno = ssoUser[0]?.EMPNO
         *     token.role = ssoUser[0]?.JOB
         *     token.department = ssoUser[0]?.DEPTNO
         *   }
         */

        // Oracle EMP 테이블에서 ENAME 조회
        const result = await getDb({ isUserLess: true }).run(async (agent) => {
          return await agent.execute<{
            USER_ID: string
            USER_NAME: string
            HAS_KR_FLAG: string
            HAS_JP_FLAG: string
            HAS_CN_FLAG: string
          }>(
            `SELECT DISTINCT USER_ID, USER_NAME, HAS_KR_FLAG, HAS_JP_FLAG, HAS_CN_FLAG 
               FROM SCOTT.TEST_USER 
              WHERE USER_ID = :username`
            , { username: credentials?.username }
          )
        })
        console.log(`SERVER: auth.ts - 쿼리 결과 - rows: ${result.affectedCount}, USER_ID: ${result.rows[0]?.USER_ID} flag: ${result.rows[0].HAS_KR_FLAG}/${result.rows[0].HAS_JP_FLAG}/${result.rows[0].HAS_CN_FLAG}`)

        if (result.rows.length === 0) return null

        const user = result.rows[0]
        return {
          userId: String(user.USER_ID),
          userName: user.USER_NAME,
          hasKrFlag: user.HAS_KR_FLAG,
          hasJpFlag: user.HAS_JP_FLAG,
          hasCnFlag: user.HAS_CN_FLAG
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
        token.userId = user.userId
        token.userName = user.userName
        token.hasKrFlag = user.hasKrFlag
        token.hasJpFlag = user.hasJpFlag
        token.hasCnFlag = user.hasCnFlag
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
      session.user.userId = token.userId
      session.user.userName = token.userName
      session.user.hasKrFlag = token.hasKrFlag
      session.user.hasJpFlag = token.hasJpFlag
      session.user.hasCnFlag = token.hasCnFlag

      return session
    },
  },
})
