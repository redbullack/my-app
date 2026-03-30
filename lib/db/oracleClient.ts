/**
 * @module oracleClient
 * @description
 * oracledb 패키지를 사용한 Oracle DB 연결 모듈.
 * 접속 정보는 .env.local의 환경변수에서 읽어온다.
 * getConnection()으로 커넥션을 획득하고, 사용 후 반드시 release() 해야 한다.
 */

import oracledb from 'oracledb'

const connectionConfig: oracledb.ConnectionAttributes = {
  user: process.env.ORACLE_USER,
  password: process.env.ORACLE_PASSWORD,
  connectString: `${process.env.ORACLE_HOST}:${process.env.ORACLE_PORT}/${process.env.ORACLE_SID}`,
}

/**
 * Oracle DB 커넥션을 반환한다.
 * 사용 후 반드시 `await connection.close()` 를 호출해 반납해야 한다.
 */
export async function getOracleConnection(): Promise<oracledb.Connection> {
  return oracledb.getConnection(connectionConfig)
}

/**
 * 쿼리를 실행하고 결과 rows를 반환하는 헬퍼.
 * outFormat을 OBJECT로 고정하여 컬럼명 키의 객체 배열로 반환한다.
 */
export async function queryOracle<T = Record<string, unknown>>(
  sql: string,
  binds: oracledb.BindParameters = [],
): Promise<T[]> {
  const connection = await getOracleConnection()
  try {
    const result = await connection.execute<T>(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    })
    return (result.rows ?? []) as T[]
  } finally {
    await connection.close()
  }
}
