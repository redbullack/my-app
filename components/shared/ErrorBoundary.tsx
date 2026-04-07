/**
 * @component ErrorBoundary
 * @description
 * 하위 컴포넌트 트리의 렌더링 에러를 잡아 격리하는 Client Component.
 * React는 클래스 컴포넌트로만 Error Boundary를 구현할 수 있다.
 *
 * 사용 예)
 *   <ErrorBoundary fallback={<div>에러 발생</div>}>
 *     <SomeComponent />
 *   </ErrorBoundary>
 */
'use client'

import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
    fallback: ReactNode
    children: ReactNode
    onError?: (error: Error, info: ErrorInfo) => void
}

interface State {
    hasError: boolean
    error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        this.props.onError?.(error, info)
        console.error('[ErrorBoundary]', error, info)
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback
        }
        return this.props.children
    }
}
