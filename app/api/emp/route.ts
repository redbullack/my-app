/**
 * @route GET /api/emp
 * @pattern Route Handler
 * @description
 * scott.emp 테이블을 조회하는 API 엔드포인트.
 * 쿼리 파라미터 enames (콤마 구분 또는 반복 키)를 받아 WHERE IN 절을 동적으로 구성한다.
 * enames가 없으면 전체 조회한다.
 *
 * 예) GET /api/emp?enames=SCOTT&enames=KING
 *     GET /api/emp  (전체 조회)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDbClient } from '@/lib/db'
import type { Emp } from '@/types/emp'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = request.nextUrl
    const enames = searchParams.getAll('enames')

    let sql: string
    let binds: Record<string, string>

    if (enames.length > 0) {
      // 바인드 변수 동적 생성: :ename0, :ename1, ...
      const bindKeys = enames.map((_, i) => `:ename${i}`)
      const bindObj: Record<string, string> = {}
      enames.forEach((name, i) => {
        bindObj[`ename${i}`] = name
      })

      sql = `SELECT * FROM scott.emp WHERE ENAME IN (${bindKeys.join(', ')})`
      binds = bindObj
    } else {
      sql = 'SELECT * FROM scott.emp'
      binds = {}
    }

    const db = getDbClient()
    const rows = await db.query<Emp>(sql, binds)

    return NextResponse.json(rows)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
