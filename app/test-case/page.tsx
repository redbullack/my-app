'use client'

/**
 * @route   /test-case
 * @pattern Client Component + Server Action + API Route (Error Testing Page)
 * @description
 * 에러 처리 & 로깅 시스템의 모든 케이스를 수동으로 발생시키고
 * DevTools Console 및 화면의 에러 로그 Grid에서 확인하는 테스트 페이지.
 *
 * ═══════════════════════════════════════════════════════════════════
 * 에러 케이스 전체 목록
 * ═══════════════════════════════════════════════════════════════════
 *
 * [A] Window 이벤트 — GlobalErrorCatcher (components/providers/GlobalErrorCatcher.tsx)
 *   A-1  Sync throw (window.onerror)        → console: client.uncaught
 *   A-2  Unhandled Promise Rejection         → console: client.unhandledrejection
 *
 * [B] React Error Boundary
 *   B-1  onCaughtError → test-case/error.tsx → console: client.boundary
 *        (이 페이지가 error.tsx UI로 전환됨. "다시 시도"로 복귀)
 *   B-2  onRecoverableError (Hydration Mismatch)
 *        → console: Warning: Text content did not match (개발 모드 전용)
 *        → 페이지는 정상 유지 (recoverable)
 *   B-3  global-error.tsx (layout.tsx 파괴 필요)
 *        ── 아래 방법 중 하나를 선택하여 app/layout.tsx 임시 수정 후 새로고침 ──
 *        [방법 A] RootLayout 함수 맨 위에 추가:
 *                 throw new Error('global-error.tsx 테스트 — 테스트 후 삭제!')
 *        [방법 B] ThemeProvider import 경로를 존재하지 않는 경로로 변경:
 *                 import ThemeProvider from '@/components/layout/ThemeProviderXXX'
 *        → global-error.tsx UI 렌더 확인 + console: [GlobalError] 출력
 *        → 테스트 완료 후 반드시 원복!
 *
 * [C] Server Action
 *   C-1  일반 Error                           → console(서버): [Server Action C-1]
 *   C-2  DB Query 오류 (잘못된 SQL)           → console(서버): [Server Action C-2]
 *   C-3  DB Connection 오류 (잘못된 DB명)     → console(서버): [Server Action C-3]
 *   C-4  DB Constraint 위반 (PK 중복 INSERT)  → console(서버): [Server Action C-4]
 *   C-5  Uncaught (try/catch 없음)            → Next.js 서버 콘솔 스택 + 클라이언트 Error catch
 *        (instrumentation.ts 활성화 시 onRequestError() 콜백으로 전달)
 *        (활성화: 루트의 _instrumentation.ts → instrumentation.ts 로 파일명 변경)
 *
 * [D] API Route (GET/POST) — /test-case/api
 *   D-1  GET server-error  (500 throw)         → console(서버): [API GET D-1]
 *   D-2  GET bad-param     (400 누락)           → console(서버): [API GET D-2]
 *   D-3  GET db-error      (잘못된 SQL)         → console(서버): [API GET D-3]
 *   D-4  POST validation   (필수 필드 누락 400) → console(서버): [API POST D-4]
 *   D-5  POST db-error     (PK 중복 INSERT 500) → console(서버): [API POST D-5]
 *
 * ───────────────────────────────────────────────────────────────────
 * 로그 확인 위치:
 *   - 브라우저 DevTools > Console: 클라이언트 에러 (A, B-1, B-2)
 *   - 터미널 (pnpm dev 실행 창): 서버 에러 (C, D)
 *   - 화면 에러 로그 Grid: C, D 케이스의 반환 결과
 * ───────────────────────────────────────────────────────────────────
 *
 * TailwindCSS:
 *   - flex, gap-*, p-*, rounded: 레이아웃
 *   - bg-[var(--color-bg-*)], text-[var(--color-text-*)]: 테마 대응 색상
 *   - border-[var(--color-border)]: 테마 대응 보더
 *   - dark: 변형 없이 CSS 변수로 다크 모드 자동 대응
 */

import { useState, useCallback } from 'react'
import { Select, Button, Grid } from '@/components/control'
import dynamic from 'next/dynamic'
import {
  actionNormalError,
  actionDbQueryError,
  actionDbConnectionError,
  actionDbConstraintError,
  actionUncaught,
  type ActionResult,
} from './_actions'

/* ── HydrationMismatch는 SSR 불일치를 재현해야 하므로 dynamic import (ssr:true) ── */
const HydrationMismatch = dynamic(() => import('./_components/HydrationMismatch'), { ssr: true })
/* ── ThrowOnRender: Error Boundary 트리거용 ──────────────────────────────────── */
const ThrowOnRender = dynamic(() => import('./_components/ThrowOnRender'), { ssr: false })

/* ── 타입 ──────────────────────────────────────────────────────────────────────*/

interface LogRow {
  NO: number
  TIME: string
  CATEGORY: string
  CASE: string
  ERROR_TYPE: string
  MESSAGE: string
  HANDLED_BY: string
  DETAIL: string
}

/* ── 에러 케이스 메타데이터 ────────────────────────────────────────────────────*/

const CATEGORY_OPTIONS = [
  { value: 'A', label: 'A. Window 이벤트 (GlobalErrorCatcher)' },
  { value: 'B', label: 'B. React Error Boundary' },
  { value: 'C', label: 'C. Server Action' },
  { value: 'D', label: 'D. API Route (GET/POST)' },
]

const TYPE_OPTIONS: Record<string, { value: string; label: string }[]> = {
  A: [
    { value: 'A-1', label: 'A-1: Sync throw (window.onerror)' },
    { value: 'A-2', label: 'A-2: Unhandled Promise Rejection' },
  ],
  B: [
    { value: 'B-1', label: 'B-1: onCaughtError → test-case/error.tsx' },
    { value: 'B-2', label: 'B-2: onRecoverableError (Hydration Mismatch)' },
    { value: 'B-3', label: 'B-3: global-error.tsx (layout.tsx 파괴 필요 — 주석 참조)' },
  ],
  C: [
    { value: 'C-1', label: 'C-1: Server Action — 일반 Error' },
    { value: 'C-2', label: 'C-2: Server Action — DB Query 오류' },
    { value: 'C-3', label: 'C-3: Server Action — DB Connection 오류' },
    { value: 'C-4', label: 'C-4: Server Action — DB Constraint 위반' },
    { value: 'C-5', label: 'C-5: Server Action — Uncaught (no try/catch)' },
  ],
  D: [
    { value: 'D-1', label: 'D-1: GET 500 — 서버 런타임 throw' },
    { value: 'D-2', label: 'D-2: GET 400 — 쿼리 파라미터 누락' },
    { value: 'D-3', label: 'D-3: GET DB 에러 — 잘못된 SQL' },
    { value: 'D-4', label: 'D-4: POST 400 — 필수 필드 누락' },
    { value: 'D-5', label: 'D-5: POST DB 에러 — PK 중복 INSERT' },
  ],
}

const GRID_COLUMNS = [
  { name: 'NO',         header: 'No',         width: 50  },
  { name: 'TIME',       header: '시각',        width: 90  },
  { name: 'CATEGORY',   header: '카테고리',    width: 100 },
  { name: 'CASE',       header: '케이스',      width: 80  },
  { name: 'ERROR_TYPE', header: '에러 타입',   width: 160 },
  { name: 'MESSAGE',    header: '메시지',      width: 280 },
  { name: 'HANDLED_BY', header: '처리 위치',   width: 220 },
  { name: 'DETAIL',     header: '상세',        width: 300 },
]

/* ── 유틸 ──────────────────────────────────────────────────────────────────────*/

function nowStr(): string {
  return new Date().toLocaleTimeString('ko-KR', { hour12: false })
}

/* ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────*/

export default function TestCasePage() {
  const [category, setCategory] = useState<string>('')
  const [errorType, setErrorType] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<LogRow[]>([])
  const [triggerBoundary, setTriggerBoundary] = useState(false)
  const [showHydration, setShowHydration] = useState(false)
  const [seqNo, setSeqNo] = useState(1)

  const addLog = useCallback((result: Omit<LogRow, 'NO' | 'TIME'>) => {
    setLogs(prev => {
      const no = prev.length + 1
      return [
        { NO: no, TIME: nowStr(), ...result },
        ...prev,
      ]
    })
    setSeqNo(n => n + 1)
  }, [])

  const handleTrigger = useCallback(async () => {
    if (!errorType) return
    setLoading(true)

    try {
      /* ── A: Window 이벤트 ─────────────────────────────────── */
      if (errorType === 'A-1') {
        // React 이벤트 핸들러 외부에서 throw → window.onerror 발생
        setTimeout(() => {
          throw new Error('A-1: Sync throw — window.onerror → GlobalErrorCatcher')
        }, 0)
        addLog({
          CATEGORY: 'A. Window 이벤트',
          CASE: 'A-1',
          ERROR_TYPE: 'Sync Throw',
          MESSAGE: 'setTimeout으로 React 트리 외부에서 throw 발생',
          HANDLED_BY: 'GlobalErrorCatcher (window.error)',
          DETAIL: 'Console: client.uncaught 로그 확인',
        })
      }

      if (errorType === 'A-2') {
        // 핸들러가 없는 Promise.reject → window.unhandledrejection
        Promise.reject(new Error('A-2: Unhandled Promise Rejection → GlobalErrorCatcher'))
        addLog({
          CATEGORY: 'A. Window 이벤트',
          CASE: 'A-2',
          ERROR_TYPE: 'UnhandledRejection',
          MESSAGE: 'Promise.reject() 후 catch 없음',
          HANDLED_BY: 'GlobalErrorCatcher (window.unhandledrejection)',
          DETAIL: 'Console: client.unhandledrejection 로그 확인',
        })
      }

      /* ── B: React Error Boundary ─────────────────────────── */
      if (errorType === 'B-1') {
        // ThrowOnRender 마운트 → 즉시 throw → test-case/error.tsx catch
        setTriggerBoundary(true)
        // ※ 이후 이 페이지는 error.tsx UI로 전환됨 — Grid 업데이트 불가
        return
      }

      if (errorType === 'B-2') {
        setShowHydration(true)
        addLog({
          CATEGORY: 'B. Error Boundary',
          CASE: 'B-2',
          ERROR_TYPE: 'HydrationMismatch',
          MESSAGE: 'Math.random() 서버/클라이언트 불일치 유발',
          HANDLED_BY: 'React onRecoverableError (경고만 발생, 페이지 정상)',
          DETAIL: 'Console: Warning: Text content did not match 확인 (개발 모드)',
        })
      }

      if (errorType === 'B-3') {
        addLog({
          CATEGORY: 'B. Error Boundary',
          CASE: 'B-3',
          ERROR_TYPE: 'RootLayoutCrash',
          MESSAGE: '수동 조작 필요 — 이 페이지 파일 상단 주석(B-3 항목) 참조',
          HANDLED_BY: 'global-error.tsx (app/global-error.tsx)',
          DETAIL: 'app/layout.tsx 임시 파괴 → 브라우저 새로고침 → global-error.tsx UI 확인 후 원복',
        })
      }

      /* ── C: Server Action ────────────────────────────────── */
      if (errorType === 'C-1') {
        const result = await actionNormalError()
        addLog({
          CATEGORY: 'C. Server Action',
          CASE: result.errorCase,
          ERROR_TYPE: result.errorType,
          MESSAGE: result.message,
          HANDLED_BY: result.handledBy,
          DETAIL: result.detail ?? '-',
        })
      }

      if (errorType === 'C-2') {
        const result = await actionDbQueryError()
        addLog({
          CATEGORY: 'C. Server Action',
          CASE: result.errorCase,
          ERROR_TYPE: result.errorType,
          MESSAGE: result.message,
          HANDLED_BY: result.handledBy,
          DETAIL: result.detail ?? '-',
        })
      }

      if (errorType === 'C-3') {
        const result = await actionDbConnectionError()
        addLog({
          CATEGORY: 'C. Server Action',
          CASE: result.errorCase,
          ERROR_TYPE: result.errorType,
          MESSAGE: result.message,
          HANDLED_BY: result.handledBy,
          DETAIL: result.detail ?? '-',
        })
      }

      if (errorType === 'C-4') {
        const result = await actionDbConstraintError()
        addLog({
          CATEGORY: 'C. Server Action',
          CASE: result.errorCase,
          ERROR_TYPE: result.errorType,
          MESSAGE: result.message,
          HANDLED_BY: result.handledBy,
          DETAIL: result.detail ?? '-',
        })
      }

      if (errorType === 'C-5') {
        // actionUncaught()는 try/catch 없이 throw — Next.js가 잡아서 Error 객체 반환
        try {
          await actionUncaught()
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error('[Client C-5] actionUncaught caught on client:', msg)
          addLog({
            CATEGORY: 'C. Server Action',
            CASE: 'C-5',
            ERROR_TYPE: 'UncaughtServerAction',
            MESSAGE: msg,
            HANDLED_BY: 'Next.js Server → 클라이언트 catch (서버 터미널 스택 확인)',
            DETAIL: 'instrumentation.ts 활성화 시 onRequestError() 콜백 전달 (현재: _instrumentation.ts → 비활성)',
          })
        }
      }

      /* ── D: API Route ────────────────────────────────────── */
      if (errorType === 'D-1') {
        try {
          const res = await fetch('/test-case/api?type=server-error')
          const data = await res.json().catch(() => ({ message: res.statusText }))
          addLog({
            CATEGORY: 'D. API Route',
            CASE: 'D-1',
            ERROR_TYPE: `HTTP ${res.status}`,
            MESSAGE: data.message ?? JSON.stringify(data),
            HANDLED_BY: 'Next.js Route Handler → 500 응답 (서버 터미널 확인)',
            DETAIL: `status: ${res.status}`,
          })
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          addLog({ CATEGORY: 'D. API Route', CASE: 'D-1', ERROR_TYPE: 'FetchError', MESSAGE: msg, HANDLED_BY: 'fetch catch', DETAIL: '-' })
        }
      }

      if (errorType === 'D-2') {
        const res = await fetch('/test-case/api') // type 파라미터 없음
        const data = await res.json()
        addLog({
          CATEGORY: 'D. API Route',
          CASE: data.errorCase ?? 'D-2',
          ERROR_TYPE: data.errorType ?? `HTTP ${res.status}`,
          MESSAGE: data.message,
          HANDLED_BY: data.handledBy ?? 'Route Handler → 400',
          DETAIL: `status: ${res.status}`,
        })
      }

      if (errorType === 'D-3') {
        const res = await fetch('/test-case/api?type=db-error')
        const data = await res.json()
        addLog({
          CATEGORY: 'D. API Route',
          CASE: data.errorCase ?? 'D-3',
          ERROR_TYPE: data.errorType ?? `HTTP ${res.status}`,
          MESSAGE: data.message,
          HANDLED_BY: data.handledBy ?? 'Route Handler',
          DETAIL: data.detail ?? `status: ${res.status}`,
        })
      }

      if (errorType === 'D-4') {
        // type 필드는 있지만 requiredField 누락
        const res = await fetch('/test-case/api', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'validation' }), // requiredField 없음
        })
        const data = await res.json()
        addLog({
          CATEGORY: 'D. API Route',
          CASE: data.errorCase ?? 'D-4',
          ERROR_TYPE: data.errorType ?? `HTTP ${res.status}`,
          MESSAGE: data.message,
          HANDLED_BY: data.handledBy ?? 'Route Handler → 400',
          DETAIL: data.detail ?? `status: ${res.status}`,
        })
      }

      if (errorType === 'D-5') {
        const res = await fetch('/test-case/api', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'db-error' }),
        })
        const data = await res.json()
        addLog({
          CATEGORY: 'D. API Route',
          CASE: data.errorCase ?? 'D-5',
          ERROR_TYPE: data.errorType ?? `HTTP ${res.status}`,
          MESSAGE: data.message,
          HANDLED_BY: data.handledBy ?? 'Route Handler → 500',
          DETAIL: data.detail ?? `status: ${res.status}`,
        })
      }
    } finally {
      setLoading(false)
    }
  }, [errorType, addLog])

  /* ── B-1 트리거: ThrowOnRender 마운트 ─────────────────────────────────────── */
  if (triggerBoundary) {
    return <ThrowOnRender message="B-1: onCaughtError 테스트 — test-case/error.tsx 가 이 에러를 catch합니다" />
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          에러 케이스 테스트 페이지
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          에러 카테고리와 타입을 선택하고 "에러 발생" 버튼을 클릭하면 해당 에러가 발생합니다.
          결과는 아래 Grid와 브라우저/서버 Console에서 확인하세요.
        </p>
      </div>

      {/* 컨트롤 영역 */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-72">
          <Select
            label="에러 카테고리"
            options={CATEGORY_OPTIONS}
            value={category}
            onChange={e => {
              setCategory(e.target.value)
              setErrorType('')
              setShowHydration(false)
            }}
            placeholder="카테고리 선택"
          />
        </div>

        <div className="w-80">
          <Select
            label="에러 타입"
            options={category ? TYPE_OPTIONS[category] : []}
            value={errorType}
            onChange={e => {
              setErrorType(e.target.value)
              setShowHydration(false)
            }}
            placeholder={category ? '타입 선택' : '카테고리를 먼저 선택하세요'}
            disabled={!category}
          />
        </div>

        <Button
          variant="danger"
          onClick={handleTrigger}
          disabled={!errorType || loading}
          isLoading={loading}
        >
          에러 발생
        </Button>

        <Button
          variant="ghost"
          onClick={() => {
            setLogs([])
            setShowHydration(false)
            setSeqNo(1)
          }}
          disabled={logs.length === 0}
        >
          로그 초기화
        </Button>
      </div>

      {/* B-3 안내 박스 */}
      {errorType === 'B-3' && (
        <div className="mb-4 rounded border border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm">
          <p className="font-semibold text-amber-700 dark:text-amber-400 mb-1">
            ⚠️ B-3: global-error.tsx 확인을 위한 수동 조작 필요
          </p>
          <p className="text-amber-700 dark:text-amber-300">
            <strong>방법 A:</strong> <code className="font-mono bg-amber-100 dark:bg-amber-900 px-1 rounded">app/layout.tsx</code> RootLayout 함수 최상단에 아래를 추가 후 브라우저 새로고침:
          </p>
          <pre className="mt-1 rounded bg-amber-100 dark:bg-amber-900 p-2 text-xs font-mono text-amber-800 dark:text-amber-200">
{`throw new Error('global-error.tsx 테스트 — 완료 후 이 줄 삭제!')`}
          </pre>
          <p className="mt-2 text-amber-700 dark:text-amber-300">
            <strong>방법 B:</strong> ThemeProvider import를 깨진 경로로 변경하면 동일 효과.
          </p>
          <p className="mt-1 font-semibold text-red-600 dark:text-red-400">
            테스트 완료 후 반드시 원복할 것!
          </p>
        </div>
      )}

      {/* B-2 Hydration Mismatch 컴포넌트 */}
      {showHydration && (
        <div className="mb-4">
          <HydrationMismatch />
        </div>
      )}

      {/* 에러 로그 Grid */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            에러 로그 ({logs.length}건)
          </h2>
          <span className="text-xs text-[var(--color-text-muted)]">
            B, C, D 카테고리만 표시 (A 카테고리는 Console 로그 확인)
          </span>
        </div>
        <div style={{ height: 400 }}>
          <Grid
            dataSource={logs}
            columns={GRID_COLUMNS}
            rowHeight={36}
            height="360px"
          />
        </div>
      </div>

      {/* 범례 */}
      <div className="mt-6 rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 text-xs text-[var(--color-text-secondary)]">
        <p className="font-semibold text-[var(--color-text-primary)] mb-2">로그 확인 위치 안내</p>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          <p><strong>A 카테고리:</strong> 브라우저 DevTools → Console (client.uncaught / client.unhandledrejection)</p>
          <p><strong>B-1:</strong> 이 페이지가 error.tsx UI로 전환됨 + Console (client.boundary)</p>
          <p><strong>B-2:</strong> Console → Warning: Text content did not match (개발 모드)</p>
          <p><strong>B-3:</strong> 전체 페이지가 global-error.tsx UI로 전환됨 + Console ([GlobalError])</p>
          <p><strong>C 카테고리:</strong> 서버 터미널(pnpm dev 창) + 위 Grid</p>
          <p><strong>D 카테고리:</strong> 서버 터미널(pnpm dev 창) + 위 Grid</p>
          <p><strong>C-5 (Uncaught):</strong> 서버 터미널 스택 + _instrumentation.ts → instrumentation.ts 이름 변경 시 onRequestError() 활성</p>
        </div>
      </div>
    </div>
  )
}
