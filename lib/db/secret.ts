/**
 * @module lib/db/secret
 * @description
 * connectString 암호화/복호화. AES-256-GCM (node:crypto).
 *
 * 토큰 형식: `enc:v1:<ivBase64>:<tagBase64>:<cipherBase64>`
 *  - v1 = 포맷 버전 (향후 키 회전 시 v2 추가 가능)
 *  - iv = 12 bytes (GCM 권장)
 *  - tag = 16 bytes 인증 태그
 *
 * 키:
 *  - `process.env.DB_CONFIG_SECRET` 에 32 bytes hex (= 64 chars) 형태로 저장.
 *  - 개발자가 키를 생성할 때는 `scripts/db-encrypt.mjs gen` 사용.
 *
 * 동작 원칙:
 *  - 키 부재/포맷 오류는 import 시점이 아닌 실제 호출 시점에 throw.
 *    (전혀 무관한 DB 까지 부팅을 막지 않기 위해.)
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGO = 'aes-256-gcm'
const IV_LEN = 12
const KEY_LEN = 32
const TOKEN_PREFIX = 'enc:v1:'

function loadKey(): Buffer {
  const hex = process.env.DB_CONFIG_SECRET
  if (!hex) {
    throw new Error(
      'DB_CONFIG_SECRET 환경변수가 설정되지 않았습니다. ' +
        '`node scripts/db-encrypt.mjs gen` 으로 32 bytes hex 키를 생성한 뒤 .env.local 에 추가하세요.',
    )
  }
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length !== KEY_LEN * 2) {
    throw new Error(
      `DB_CONFIG_SECRET 형식이 올바르지 않습니다. ${KEY_LEN} bytes hex (${KEY_LEN * 2} chars) 가 필요합니다.`,
    )
  }
  return Buffer.from(hex, 'hex')
}

export function isEncryptedToken(value: string): boolean {
  return value.startsWith(TOKEN_PREFIX)
}

export function encryptConnectString(plain: string): string {
  const key = loadKey()
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, key, iv)
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${TOKEN_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`
}

export function decryptConnectString(token: string): string {
  if (!isEncryptedToken(token)) {
    throw new Error(`암호화 토큰 형식이 아닙니다. (expected "${TOKEN_PREFIX}…" prefix)`)
  }
  const body = token.slice(TOKEN_PREFIX.length)
  const parts = body.split(':')
  if (parts.length !== 3) {
    throw new Error('암호화 토큰 구조가 올바르지 않습니다. (iv:tag:cipher 3분할 필요)')
  }
  const [ivB64, tagB64, ctB64] = parts
  const key = loadKey()
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const ct = Buffer.from(ctB64, 'base64')

  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  const pt = Buffer.concat([decipher.update(ct), decipher.final()])
  return pt.toString('utf8')
}
