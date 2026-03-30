/**
 * @route /api/auth/*
 * @pattern Route Handler (Catch-all)
 * @description
 * NextAuth v5 Route Handler. /api/auth/signin, /api/auth/signout,
 * /api/auth/session 등 모든 인증 엔드포인트를 처리한다.
 */

import { handlers } from '@/lib/auth/auth'

export const { GET, POST } = handlers
