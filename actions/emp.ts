/**
 * @description EMP 테이블 관련 Server Actions
 * 'use server' 지시어: 이 파일의 모든 export 함수가 Server Action으로 동작한다.
 * Client Component에서 직접 호출하지만, 실행은 서버에서만 이루어진다.
 * Route Handler(/api/emp)를 거치지 않고 DB를 직접 조회하는 패턴이다.
 */
'use server'

import { queryOracle } from '@/lib/db'
import type { Emp } from '@/types/emp'

/**
 * EMP 테이블 조회 Server Action
 * @param enames 조회할 사원명 배열. 빈 배열이면 전체 조회.
 * @returns Emp 배열
 */
export async function fetchEmpByNames(enames: string[]): Promise<Emp[]> {
  try {
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

    return queryOracle<Emp>(sql, binds)

  } catch (error) {
    console.error("DB Error:", error);
    throw new Error('데이터를 불러오는 데 실패했습니다.');
  }
}
