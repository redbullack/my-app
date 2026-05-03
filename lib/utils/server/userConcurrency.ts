/**
 * @module lib/utils/server/userConcurrency
 * @description
 * 유저 단위 Server Action 동시 실행 게이트.
 *
 * 헤비 유저가 화면을 여러 개 띄워두고 무거운 액션을 동시에 쏟아내는 경우,
 * 한 명이 DB 풀/이벤트 루프를 비정상적으로 점유하는 것을 막기 위해
 * 액션 진입 시점(actionAgent) 에 in-process semaphore 를 한 겹 둔다.
 *
 * 동작 모델:
 *  - 유저별 slot: 동시 실행(running) 카운터 + FIFO 대기열(queue).
 *  - running < MAX_PER_USER 이면 즉시 진입.
 *  - 한도 초과 시 큐에 대기. MAX_WAIT_MS 안에 자리가 나면 진입, 못 나면
 *    ActionBusyError 로 reject → actionWrapper 가 ActionError(type:'busy') 로 직렬화.
 *  - 큐 자체가 폭주하지 않도록 MAX_QUEUE 로 백프레셔.
 *
 * 운영 메모:
 *  - 단일 인스턴스 in-memory 구조. 멀티 인스턴스라면 인스턴스 수만큼 한도가
 *    배수로 늘어남을 감안해 숫자를 잡거나, 더 엄격한 글로벌 한도가 필요하면
 *    Redis 기반으로 승격할 것.
 *  - userId 가 없는(비로그인) 호출은 게이트 적용 제외 — 호출부에서 판단.
 *  - 게이트는 "시작 전 차단" 용도. 이미 시작된 작업의 강제 취소는 별도 설계.
 */

export class ActionBusyError extends Error {
    readonly reason: 'queue_full' | 'queue_timeout'
    constructor(reason: 'queue_full' | 'queue_timeout') {
        super(`action gate: ${reason}`)
        this.name = 'ActionBusyError'
        this.reason = reason
    }
}

interface Waiter {
    resolve: () => void
    reject: (e: Error) => void
    timer: NodeJS.Timeout
}

interface Slot {
    running: number
    queue: Waiter[]
}

/** 유저당 동시 실행 가능한 액션 수 */
const MAX_PER_USER = 4
/** 큐에서 자리 대기 최대 시간(ms) */
const MAX_WAIT_MS = 5_000
/** 큐 최대 깊이 — 초과 시 즉시 busy 반환 */
const MAX_QUEUE = 20

const slots = new Map<string, Slot>()

function getSlot(userId: string): Slot {
    let s = slots.get(userId)
    if (!s) {
        s = { running: 0, queue: [] }
        slots.set(userId, s)
    }
    return s
}

/**
 * 유저 단위 슬롯을 점유한다. 반환된 release 함수를 finally 에서 반드시 호출할 것.
 * 한도 초과 + 큐 타임아웃/풀 시 ActionBusyError throw.
 */
export async function acquireUserSlot(userId: string): Promise<() => void> {
    const s = getSlot(userId)
    if (s.running < MAX_PER_USER) {
        s.running++
        return () => releaseUserSlot(userId)
    }

    if (s.queue.length >= MAX_QUEUE) {
        throw new ActionBusyError('queue_full')
    }

    await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
            const i = s.queue.findIndex((w) => w.timer === timer)
            if (i >= 0) s.queue.splice(i, 1)
            reject(new ActionBusyError('queue_timeout'))
        }, MAX_WAIT_MS)
        s.queue.push({ resolve, reject, timer })
    })

    // 대기에서 깨어남 — 이전 holder 가 자기 자리를 그대로 넘겨준 상태이므로
    // running 은 이미 증가되어 있다(releaseUserSlot 참고).
    return () => releaseUserSlot(userId)
}

function releaseUserSlot(userId: string): void {
    const s = slots.get(userId)
    if (!s) return

    const next = s.queue.shift()
    if (next) {
        // 자리를 그대로 승계 — running 카운터는 유지.
        clearTimeout(next.timer)
        next.resolve()
        return
    }

    s.running--
    if (s.running <= 0 && s.queue.length === 0) {
        slots.delete(userId)
    }
}

/** 운영/관측용 — 현재 게이트 상태 스냅샷 */
export function snapshotUserConcurrency(): {
    users: number
    totalRunning: number
    totalQueued: number
} {
    let totalRunning = 0
    let totalQueued = 0
    for (const s of slots.values()) {
        totalRunning += s.running
        totalQueued += s.queue.length
    }
    return { users: slots.size, totalRunning, totalQueued }
}
