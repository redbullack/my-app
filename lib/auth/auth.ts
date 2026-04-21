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
import { getDb } from '../db'

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
        const username = (credentials.username as string).toUpperCase()
        const db = getDb('MAIN')
        const result = await db.query<Emp>(
          'SELECT EMPNO, ENAME, JOB FROM EMP WHERE ENAME = :username',
          [username],
        )

        if (result.rows.length === 0) return null

        const emp = result.rows[0]
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
    /**
     * ════════════════════════════════════════════════════════════
     * JWT Callback — 토큰에 세팅할 값 가이드
     * ════════════════════════════════════════════════════════════
     *
     * JWT 토큰은 서버 측에서만 복호화되므로 Session보다는 안전하지만,
     * 토큰 크기가 커지면 매 요청의 쿠키 오버헤드가 증가한다.
     * 또한 탈취 시 내부 정보가 노출되므로 민감 데이터는 최소화해야 한다.
     *
     * ── 보안 관점: 세팅하면 좋은 값 ──
     *
     *   token.permissions = ['read:emp', 'write:dept']
     *     → RBAC/ABAC 권한 배열. 매 요청마다 DB 조회 없이 인가 판단 가능
     *
     *   token.department = 'SALES'
     *     → 부서 기반 데이터 접근 제어에 활용
     *
     *   token.loginIp = request.headers['x-forwarded-for']
     *     → IP 바인딩으로 토큰 탈취 후 다른 IP에서 사용 감지
     *
     *   token.loginAt = Date.now()
     *     → 로그인 시각 기록. 감사 로그, 강제 재인증 판단에 활용
     *
     *   token.mfaVerified = true
     *     → MFA 완료 여부. 민감 작업 시 추가 인증 요구 판단
     *
     * ── 보안 관점: 세팅하면 위험한 값 (절대 금지) ──
     *
     *   token.password = credentials.password          // ❌ 절대 금지
     *     → 평문 비밀번호 저장. 토큰 탈취 시 비밀번호 완전 노출
     *
     *   token.ssoAccessToken = account.access_token    // ❌ 위험
     *     → SSO access_token을 JWT에 저장하면 토큰 탈취 시 SSO 전체 권한 노출
     *     → 필요하다면 서버 측 세션 스토어(Redis 등)에 저장하고 참조 ID만 토큰에 보관
     *
     *   token.ssn = '901231-1234567'                   // ❌ 절대 금지
     *     → 주민등록번호, 카드번호 등 PII. 법적 문제 + 유출 시 심각한 피해
     *
     *   token.dbConnectionString = process.env.DB_URL  // ❌ 절대 금지
     *     → 인프라 시크릿은 어떤 경우에도 토큰에 포함 불가
     *
     * ── 유틸 관점: 세팅하면 편리한 값 ──
     *
     *   token.locale = profile.locale || 'ko'
     *     → 사용자 언어 설정. i18n 처리 시 DB 재조회 없이 사용
     *
     *   token.timezone = 'Asia/Seoul'
     *     → 시간대별 표시 포맷팅에 활용
     *
     *   token.avatarUrl = profile.picture
     *     → 프로필 이미지 URL. 단, URL이 길면 쿠키 크기 주의
     *
     *   token.displayName = profile.name
     *     → UI 표시용 이름. name과 별도로 닉네임 등을 저장할 때
     *
     * ════════════════════════════════════════════════════════════
     */
    async jwt({ token, user }) {
      // 최초 로그인 시 사용자 정보를 토큰에 추가
      if (user) {
        token.role = user.role
        token.empno = user.empno
        token.issuedAt = Date.now()
      }

      /**
       * [SSO 전환 시] account, profile 파라미터 활용 예시:
       *
       * async jwt({ token, user, account, profile }) {
       *   if (account?.provider === 'corporate-sso') {
       *     // SSO에서 받은 그룹/역할 매핑
       *     token.role = (profile as any).groups?.includes('admin') ? 'ADMIN' : 'USER'
       *     token.department = (profile as any).department
       *     token.permissions = (profile as any).permissions || []
       *
       *     // ⚠️ access_token은 서버 측 스토어에 저장 권장
       *     // await redis.set(`sso_token:${token.sub}`, account.access_token, 'EX', 3600)
       *   }
       *   return token
       * }
       */

      // Sliding window 토큰 갱신: 발급 후 10분 경과 시 issuedAt 갱신
      // → maxAge(15분) 기준이 리셋되어 세션이 연장됨
      const issued = token.issuedAt as number | undefined
      if (issued && Date.now() - issued > 10 * 60 * 1000) {
        token.issuedAt = Date.now()
      }

      return token
    },

    /**
     * ════════════════════════════════════════════════════════════
     * Session Callback — 클라이언트 노출 값 가이드
     * ════════════════════════════════════════════════════════════
     *
     * ⚠️ 핵심 원칙: session 객체는 클라이언트(브라우저)에 그대로 노출된다.
     * useSession(), getSession()으로 누구나 읽을 수 있으므로
     * 반드시 "최소 권한 원칙"을 적용하여 필요한 값만 전달한다.
     *
     * ── 안전하게 노출 가능한 값 ──
     *
     *   session.user.id          → 사용자 식별자 (공개 ID)
     *   session.user.name        → 표시용 이름
     *   session.user.role        → UI 분기용 역할 (단, 실제 인가는 서버에서 재검증)
     *   session.user.empno       → 사번 (사내 시스템에서는 공개 정보)
     *   session.user.department  → 부서명 (UI 표시용)
     *   session.user.avatarUrl   → 프로필 이미지
     *   session.user.locale      → 언어 설정
     *
     * ── 노출하면 위험한 값 (절대 금지) ──
     *
     *   session.user.permissions = token.permissions   // ❌ 위험
     *     → 권한 목록을 클라이언트에 노출하면 공격자가 API 엔드포인트 탐색 가능
     *     → 권한 체크는 반드시 서버 측(middleware, API)에서 token 기반으로 수행
     *
     *   session.user.email = token.email               // ⚠️ 주의
     *     → 이메일은 상황에 따라 노출 가능하나, 스크래핑/피싱에 악용될 수 있음
     *     → 표시 필요 시 마스킹 처리 권장: 'u***@company.com'
     *
     *   session.user.accessToken = token.ssoAccessToken // ❌ 절대 금지
     *     → SSO 토큰이 클라이언트에 노출되면 사용자 사칭, API 무단 호출 가능
     *
     *   session.user.loginIp = token.loginIp            // ❌ 금지
     *     → IP 주소는 개인정보. 클라이언트에 노출 불필요
     *
     * ════════════════════════════════════════════════════════════
     */
    async session({ session, token }) {
      session.user.id = token.sub!
      session.user.role = token.role as string
      session.user.empno = token.empno as number

      /**
       * [SSO 전환 시] 추가 세션 필드 예시:
       *
       *   session.user.department = token.department as string
       *   session.user.avatarUrl = token.avatarUrl as string
       *   session.user.locale = token.locale as string
       *
       * ⚠️ 아래처럼 하면 안 됨:
       *   session.user.accessToken = token.ssoAccessToken  // ❌ 클라이언트 노출 위험
       *   session.user.permissions = token.permissions     // ❌ 공격 표면 확대
       */

      return session
    },
  },
})
