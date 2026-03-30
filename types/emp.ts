/**
 * @description scott.emp 테이블 컬럼에 대응하는 TypeScript 타입 정의
 */

export interface Emp {
  EMPNO: number
  ENAME: string
  JOB: string
  MGR: number | null
  HIREDATE: string | Date
  SAL: number
  COMM: number | null
  DEPTNO: number
}
