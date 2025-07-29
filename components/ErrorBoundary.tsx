'use client'

import React, { Component, ReactNode } from 'react'
import { logger } from '@/lib/logging/logger'
import { getClientErrorMessage } from '@/lib/errors/handler'

interface Props {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 에러 로깅
    logger.error('ErrorBoundary caught an error', {
      error: error,
      metadata: {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      }
    })

    // 커스텀 에러 핸들러 호출
    this.props.onError?.(error, errorInfo)
  }

  reset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      // 커스텀 fallback이 있으면 사용
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset)
      }

      // 기본 에러 UI
      return (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-lg font-semibold text-red-800 mb-2">
            문제가 발생했습니다
          </h3>
          <p className="text-red-600 mb-4">
            {getClientErrorMessage(this.state.error)}
          </p>
          <button
            onClick={this.reset}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            다시 시도
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * 에러 바운더리 Hook (함수형 컴포넌트용)
 */
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null)

  React.useEffect(() => {
    if (error) {
      throw error
    }
  }, [error])

  const resetError = () => setError(null)
  const captureError = (error: Error) => setError(error)

  return { resetError, captureError }
}

/**
 * 비동기 에러 처리를 위한 래퍼
 */
export function AsyncErrorBoundary({ 
  children, 
  fallback 
}: { 
  children: ReactNode
  fallback?: ReactNode 
}) {
  const [error, setError] = React.useState<Error | null>(null)

  React.useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logger.error('Unhandled promise rejection', {
        metadata: {
          reason: event.reason,
          promise: event.promise,
        }
      })
      
      setError(new Error(event.reason?.message || 'Unhandled promise rejection'))
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  if (error) {
    return (
      <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="text-lg font-semibold text-yellow-800 mb-2">
          비동기 작업 중 오류
        </h3>
        <p className="text-yellow-600 mb-4">
          {error.message}
        </p>
        <button
          onClick={() => setError(null)}
          className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
        >
          닫기
        </button>
      </div>
    )
  }

  return <>{children}</>
}