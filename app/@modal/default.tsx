/**
 * @pattern Parallel Route — default.tsx
 * @description
 * @modal 슬롯의 기본 fallback. Intercepting Routes가 활성화되지 않은 상태에서
 * 이 슬롯은 null을 렌더링한다. default.tsx가 없으면 Parallel Route가
 * 매칭되지 않는 경로에서 404가 발생한다.
 */
export default function ModalDefault() {
  return null
}
