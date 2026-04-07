#!/usr/bin/env node
/**
 * scripts/db-encrypt.mjs
 *
 * DB connectString 암복호화 도우미. 추가 의존성 없이 node 만으로 실행 가능.
 *
 * 사용법:
 *   node scripts/db-encrypt.mjs gen
 *     → 새 DB_CONFIG_SECRET 키(32 bytes hex) 생성
 *
 *   DB_CONFIG_SECRET=... node scripts/db-encrypt.mjs encrypt "user/pw@host:1521/svc"
 *     → 평문 connectString 을 enc:v1:... 토큰으로 암호화
 *
 *   DB_CONFIG_SECRET=... node scripts/db-encrypt.mjs decrypt "enc:v1:..."
 *     → 토큰을 평문으로 복호화 (검증용)
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGO = 'aes-256-gcm'
const IV_LEN = 12
const KEY_LEN = 32
const PREFIX = 'enc:v1:'

function loadKey() {
  const hex = process.env.DB_CONFIG_SECRET
  if (!hex) {
    console.error('ERROR: DB_CONFIG_SECRET 환경변수가 필요합니다. `node scripts/db-encrypt.mjs gen` 으로 생성하세요.')
    process.exit(1)
  }
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length !== KEY_LEN * 2) {
    console.error(`ERROR: DB_CONFIG_SECRET 는 ${KEY_LEN * 2} chars hex 여야 합니다.`)
    process.exit(1)
  }
  return Buffer.from(hex, 'hex')
}

function encrypt(plain) {
  const key = loadKey()
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, key, iv)
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`
}

function decrypt(token) {
  if (!token.startsWith(PREFIX)) {
    console.error(`ERROR: 토큰이 ${PREFIX} 로 시작해야 합니다.`)
    process.exit(1)
  }
  const [ivB64, tagB64, ctB64] = token.slice(PREFIX.length).split(':')
  const key = loadKey()
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  const pt = Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()])
  return pt.toString('utf8')
}

const [, , cmd, arg] = process.argv

switch (cmd) {
  case 'gen': {
    const key = randomBytes(KEY_LEN).toString('hex')
    console.log('# .env.local 에 추가하세요:')
    console.log(`DB_CONFIG_SECRET=${key}`)
    break
  }
  case 'encrypt': {
    if (!arg) {
      console.error('Usage: node scripts/db-encrypt.mjs encrypt "user/pw@host:1521/svc"')
      process.exit(1)
    }
    console.log(encrypt(arg))
    break
  }
  case 'decrypt': {
    if (!arg) {
      console.error('Usage: node scripts/db-encrypt.mjs decrypt "enc:v1:..."')
      process.exit(1)
    }
    console.log(decrypt(arg))
    break
  }
  default:
    console.log(`Usage:
  node scripts/db-encrypt.mjs gen
  DB_CONFIG_SECRET=... node scripts/db-encrypt.mjs encrypt "user/pw@host:1521/svc"
  DB_CONFIG_SECRET=... node scripts/db-encrypt.mjs decrypt "enc:v1:..."`)
    process.exit(cmd ? 1 : 0)
}
