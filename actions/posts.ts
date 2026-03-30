/**
 * @description 블로그 관련 Server Actions
 * 'use server' 지시어: 이 파일의 모든 export 함수가 Server Action으로 동작한다.
 * Server Action은 클라이언트에서 호출 가능하지만 서버에서만 실행된다.
 */
'use server'

import { revalidatePath } from 'next/cache'
import { SAMPLE_POSTS } from '@/lib/constants'

/** 블로그 글 목록 조회 (서버 전용) */
export async function getPosts() {
  // 실제 프로젝트에서는 DB/API 호출
  return SAMPLE_POSTS
}

/** 블로그 글 단건 조회 */
export async function getPostBySlug(slug: string) {
  return SAMPLE_POSTS.find(post => post.slug === slug) ?? null
}

/** 블로그 캐시 갱신 (revalidatePath 데모) */
export async function revalidateBlog() {
  revalidatePath('/blog')
  return { success: true, message: '/blog 경로가 재검증되었습니다.' }
}
