/**
 * @route POST /api/emp/[action]
 * @pattern Dynamic Segment Route Handler ([param])
 * @description
 * 동적 세그먼트를 사용하는 Route Handler.
 * [action] 파라미터로 수행할 작업을 구분한다.
 *
 * 현재 지원하는 action:
 *   - "search": POST body의 enames 배열로 scott.emp 테이블을 조회한다.
 *
 * 예) POST /api/emp/search
 *     Body: { "enames": ["SCOTT", "KING"] }
 *     Body: {} 또는 { "enames": [] }  → 전체 조회
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDbClient } from '@/lib/db'
import type { Emp } from '@/types/emp'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
): Promise<NextResponse> {
  const { action } = await params

  if (action !== 'search') {
    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 404 },
    )
  }

  try {
    const body = (await request.json()) as { enames?: string[] }
    const enames = body.enames ?? []

    let sql: string
    let binds: Record<string, string>

    if (enames.length > 0) {
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
