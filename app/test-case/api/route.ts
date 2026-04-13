/**
 * @route  GET/POST /test-case/api
 * @description
 * app/test-case 전용 API Route — GET/POST 방식의 에러 케이스를 재현한다.
 *
 * ─────────────────────────────────────────────────────────────────
 * GET  ?type=server-error   D-1: 런타임 throw → 500
 * GET  ?type=bad-param      D-2: 필수 파라미터 누락 → 400
 * GET  ?type=db-error       D-3: 잘못된 SQL → DbError → 500
 * POST body.type=validation D-4: body 누락 필드 → 400
 * POST body.type=db-error   D-5: DB INSERT 실패 → 500
 * ─────────────────────────────────────────────────────────────────
 *
 * TailwindCSS: 이 파일은 서버 코드이므로 CSS 없음.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDb, DbError } from '@/lib/db'

/* ── GET ──────────────────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type')

  // D-2: 필수 파라미터 누락
  if (!type) {
    console.warn('[API GET D-2] missing required query param: type')
    return NextResponse.json(
      {
        success: false,
        errorCase: 'D-2',
        errorType: 'ValidationError',
        message: '필수 쿼리 파라미터 "type"이 누락되었습니다.',
        handledBy: 'Route Handler → 400 응답',
      },
      { status: 400 },
    )
  }

  // D-1: 런타임 throw → try/catch 없이 Next.js가 500 반환
  if (type === 'server-error') {
    console.error('[API GET D-1] intentional server-error throw')
    throw new Error('D-1: API Route GET 의도적 서버 에러 — Next.js가 500으로 변환')
  }

  // D-3: DB Query 에러
  if (type === 'db-error') {
    const db = getDb('MAIN')
    try {
      await db.query('SELECT * FROM NONEXISTENT_TABLE_FOR_API_TEST WHERE 1=1')
      return NextResponse.json({ success: true })
    } catch (err) {
      const isDbErr = err instanceof DbError
      console.error('[API GET D-3] dbError:', err)
      return NextResponse.json(
        {
          success: false,
          errorCase: 'D-3',
          errorType: isDbErr ? `DbError(${(err as DbError).category})` : 'Error',
          message: isDbErr ? (err as DbError).message : (err instanceof Error ? err.message : String(err)),
          detail: isDbErr ? `category=${(err as DbError).category} | code=${(err as DbError).code}` : undefined,
          handledBy: 'Route Handler try/catch → 500 응답',
        },
        { status: 500 },
      )
    }
  }

  return NextResponse.json(
    { success: false, message: `알 수 없는 type: ${type}` },
    { status: 400 },
  )
}

/* ── POST ─────────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      {
        success: false,
        errorCase: 'D-4',
        errorType: 'ParseError',
        message: 'Request body를 JSON으로 파싱할 수 없습니다.',
        handledBy: 'Route Handler → 400 응답',
      },
      { status: 400 },
    )
  }

  const { type, requiredField } = body as { type?: string; requiredField?: string }

  // D-4: 필수 필드 누락 validation
  if (!type) {
    console.warn('[API POST D-4] missing required body field: type')
    return NextResponse.json(
      {
        success: false,
        errorCase: 'D-4',
        errorType: 'ValidationError',
        message: 'body에 필수 필드 "type"이 없습니다.',
        handledBy: 'Route Handler → 400 응답',
      },
      { status: 400 },
    )
  }

  if (type === 'validation') {
    if (!requiredField) {
      console.warn('[API POST D-4] missing requiredField')
      return NextResponse.json(
        {
          success: false,
          errorCase: 'D-4',
          errorType: 'ValidationError',
          message: 'body.requiredField 가 비어 있습니다.',
          detail: `전달된 body: ${JSON.stringify(body)}`,
          handledBy: 'Route Handler → 400 응답',
        },
        { status: 400 },
      )
    }
    return NextResponse.json({ success: true, message: 'OK' })
  }

  // D-5: DB 에러 (PK 중복 INSERT)
  if (type === 'db-error') {
    const db = getDb('MAIN')
    try {
      // SCOTT.DEPT DEPTNO=10은 이미 존재 → ORA-00001 unique constraint violated
      await db.execute(
        `INSERT INTO SCOTT.DEPT (DEPTNO, DNAME, LOC) VALUES (:deptno, :dname, :loc)`,
        { deptno: 10, dname: 'API_TEST', loc: 'API_TEST' },
      )
      return NextResponse.json({ success: true })
    } catch (err) {
      const isDbErr = err instanceof DbError
      console.error('[API POST D-5] dbError:', err)
      return NextResponse.json(
        {
          success: false,
          errorCase: 'D-5',
          errorType: isDbErr ? `DbError(${(err as DbError).category})` : 'Error',
          message: isDbErr ? (err as DbError).message : (err instanceof Error ? err.message : String(err)),
          detail: isDbErr ? `category=${(err as DbError).category} | code=${(err as DbError).code}` : undefined,
          handledBy: 'Route Handler try/catch → 500 응답',
        },
        { status: 500 },
      )
    }
  }

  return NextResponse.json(
    { success: false, message: `알 수 없는 type: ${type}` },
    { status: 400 },
  )
}
