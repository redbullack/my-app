'use client'

import { usePathname } from 'next/navigation'

export function useAppInfo(): { appId: string, deptSite: string } {
  const [appId, deptSite] = usePathname().slice(1).split('/')
  console.log(`Client: useAppInfo.ts - usePathname: ${usePathname()}, appId: ${appId}, deptSite: ${deptSite}`)
  return { appId, deptSite }
}
