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
    role?: string
    empno?: number

    /**
     * [SSO 전환 시 추가 가능 필드]
     *
     * ── 보안/인가 관점 ──
     * permissions?: string[]      → RBAC 권한 목록 (JWT에만 저장, Session 노출 금지)
     * mfaVerified?: boolean       → MFA 인증 완료 여부
     *
     * ── 유틸/UI 관점 ──
     * department?: string         → 부서명 (조직도 연동)
     * avatarUrl?: string          → 프로필 이미지 URL
     * locale?: string             → 언어 설정 ('ko', 'en')
     * timezone?: string           → 시간대 ('Asia/Seoul')
     * displayName?: string        → 표시용 이름 (닉네임 등)
     */
  }

  interface Session {
    user: {
      id: string
      name: string
      role: string
      empno: number

      /**
       * [SSO 전환 시 추가 가능 필드 — 클라이언트 노출 안전한 값만]
       *
       * department?: string       → ✅ 부서명 (사내 공개 정보)
       * avatarUrl?: string        → ✅ 프로필 이미지
       * locale?: string           → ✅ 언어 설정
       *
       * ⚠️ 아래 값은 Session에 절대 포함하지 않는다:
       * permissions?: string[]    → ❌ 공격 표면 확대 (서버에서만 사용)
       * accessToken?: string      → ❌ SSO 토큰 클라이언트 노출 위험
       * email?: string            → ⚠️ 표시 시 마스킹 필수
       */
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string
    empno?: number
    issuedAt?: number

    /**
     * [SSO 전환 시 추가 가능 필드]
     *
     * ── 보안 관점: 세팅 권장 ──
     * permissions?: string[]      → 서버 측 인가 판단용 (Session에는 노출 금지)
     * department?: string         → 부서 기반 데이터 접근 제어
     * loginIp?: string            → 토큰 탈취 감지 (IP 바인딩)
     * loginAt?: number            → 감사 로그, 강제 재인증 판단
     * mfaVerified?: boolean       → 민감 작업 시 추가 인증 여부
     *
     * ── 유틸 관점: 세팅하면 편리 ──
     * locale?: string             → i18n 처리
     * timezone?: string           → 시간 포맷팅
     * avatarUrl?: string          → 프로필 이미지 (URL 길이 → 쿠키 크기 주의)
     * displayName?: string        → UI 표시용 이름
     *
     * ── 세팅 금지 ──
     * password?: string           → ❌ 평문 비밀번호 절대 금지
     * ssoAccessToken?: string     → ❌ 서버 측 스토어(Redis)에 보관 권장
     * ssn?: string                → ❌ PII(개인식별정보) 저장 금지
     */
  }
}
