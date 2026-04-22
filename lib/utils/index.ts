/**
 * @module lib/utils
 * @description
 * 프레임워크 유틸 레이어의 **공용 public barrel** (클라이언트/공용 심볼 전용).
 *
 * 서버 전용 심볼(`actionAgent` 등)은 `@/lib/utils/server` 로 분리되어 있다.
 * 내부 전용(`handleGlobalError`)은 barrel 에 노출하지 않는다 — useAction/Grid/Input 만 호출.
 */

export { cn, delay, formatDate } from './common'
export {
  AppError,
  type ActionResponse,
  type ActionError,
  type ErrorType,
} from './type'
