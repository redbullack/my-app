/**
 * @module lib/db/config/databases
 * @description
 * DB 레지스트리. C# 레거시의 DB.config XML 을 TypeScript 로 이식한 형태.
 *
 * 사용:
 * ```ts
 * import { getDb } from '@/lib/db'
 * const db = getDb('MAIN')
 * const rows = await db.query('SELECT * FROM emp WHERE deptno = :d', { d: 10 })
 * ```
 *
 * 신규 DB 추가 절차:
 *  1) `node scripts/db-encrypt.mjs "user/pw@host:1521/svc"` 로 ciphertext 생성
 *  2) 본 파일에 항목 추가 (encrypt: true 권장)
 *  3) `getDb('NEW_NAME')` 으로 사용 — DbName literal union 이 자동 갱신되어 type-safe
 *
 * 보안:
 *  - encrypt: true 인 항목은 ciphertext 만 commit 가능. 평문은 .env.local 에도 두지 않음.
 *  - 복호화 키는 `DB_CONFIG_SECRET` (32 bytes hex) 환경변수.
 */

import type { DbConfigEntry } from '../types'

export const databases = {
  /** 메인 운영 Oracle DB. */
  MAIN: {
    providerName: 'oracle',
    encrypt: false,
    // 학습용 기본값. 운영에서는 반드시 encrypt:true + ciphertext 로 교체.
    connectString: `${process.env.ORACLE_USER ?? 'scott'}/${process.env.ORACLE_PASSWORD ?? 'tiger'}@${process.env.ORACLE_HOST ?? 'localhost'}:${process.env.ORACLE_PORT ?? '1521'}/${process.env.ORACLE_SID ?? 'xe'}`,
    pool: { min: 1, max: 10, increment: 1, timeoutSec: 60 },
  },
  // 예시 — 실제 사용 시 주석 해제 + ciphertext 교체
  // REPORT: {
  //   providerName: 'oracle',
  //   encrypt: true,
  //   connectString: 'enc:v1:....:....:....',
  //   pool: { min: 1, max: 5, timeoutSec: 120 },
  // },
} as const satisfies Record<string, DbConfigEntry>

/** 레지스트리에 등록된 DB 이름의 literal union. 오타 시 컴파일 에러. */
export type DbName = keyof typeof databases
