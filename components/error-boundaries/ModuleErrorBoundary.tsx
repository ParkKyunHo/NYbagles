/**
 * Module Error Boundary
 * 모듈별 에러를 격리하고 처리하는 Error Boundary
 */

'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertCircle, RefreshCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { logger } from '@/lib/logging/logger'

interface Props {
  children: ReactNode
  moduleName: string
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorCount: number
  lastErrorTime: number
}

export class ModuleErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: NodeJS.Timeout | null = null

  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      lastErrorTime: 0
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { moduleName, onError } = this.props
    const now = Date.now()
    const timeSinceLastError = now - this.state.lastErrorTime

    // Log error with module context
    logger.error(`Module Error: ${moduleName}`, {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      metadata: {
        module: moduleName,
        errorCount: this.state.errorCount + 1,
        timeSinceLastError,
        componentStack: errorInfo.componentStack
      }
    })

    // Update error count and time
    this.setState(prevState => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
      lastErrorTime: now
    }))

    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo)
    }

    // Auto-reset after 30 seconds if this is the first error
    if (this.state.errorCount === 0) {
      this.scheduleReset()
    }

    // If multiple errors in short time, don't auto-reset
    if (timeSinceLastError < 5000 && this.state.errorCount > 2) {
      this.cancelReset()
    }
  }

  scheduleReset = () => {
    this.resetTimeoutId = setTimeout(() => {
      this.handleReset()
    }, 30000)
  }

  cancelReset = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
      this.resetTimeoutId = null
    }
  }

  handleReset = () => {
    this.cancelReset()
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      lastErrorTime: 0
    })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/dashboard'
  }

  componentWillUnmount() {
    this.cancelReset()
  }

  render() {
    const { hasError, error, errorCount } = this.state
    const { children, moduleName, fallback } = this.props

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback) {
        return <>{fallback}</>
      }

      // Determine error severity
      const isRecurringError = errorCount > 3
      const errorType = this.getErrorType(error)
      const userMessage = this.getUserFriendlyMessage(error, errorType)

      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="max-w-2xl w-full space-y-6">
            <Alert variant={isRecurringError ? "destructive" : "default"}>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="text-lg font-semibold">
                {moduleName} 모듈 오류
              </AlertTitle>
              <AlertDescription className="mt-3 space-y-4">
                <p>{userMessage}</p>
                
                {process.env.NODE_ENV === 'development' && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                      개발자 정보 보기
                    </summary>
                    <div className="mt-2 space-y-2">
                      <p className="text-xs text-muted-foreground">
                        오류: {error.message}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        타입: {errorType}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        발생 횟수: {errorCount}
                      </p>
                      {error.stack && (
                        <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                          {error.stack}
                        </pre>
                      )}
                    </div>
                  </details>
                )}
              </AlertDescription>
            </Alert>

            <div className="flex gap-3 justify-center">
              <Button
                onClick={this.handleReset}
                variant="primary"
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                다시 시도
              </Button>
              
              {isRecurringError && (
                <>
                  <Button
                    onClick={this.handleReload}
                    variant="outline"
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    페이지 새로고침
                  </Button>
                  
                  <Button
                    onClick={this.handleGoHome}
                    variant="outline"
                    className="gap-2"
                  >
                    <Home className="h-4 w-4" />
                    대시보드로
                  </Button>
                </>
              )}
            </div>

            {!isRecurringError && (
              <p className="text-center text-sm text-muted-foreground">
                30초 후 자동으로 재시도됩니다...
              </p>
            )}
          </div>
        </div>
      )
    }

    return children
  }

  private getErrorType(error: Error): string {
    const errorName = error.name.toLowerCase()
    const errorMessage = error.message.toLowerCase()

    if (errorName.includes('network') || errorMessage.includes('fetch')) {
      return 'network'
    }
    if (errorName.includes('auth') || errorMessage.includes('unauthorized')) {
      return 'auth'
    }
    if (errorName.includes('validation') || errorMessage.includes('invalid')) {
      return 'validation'
    }
    if (errorName.includes('notfound') || errorMessage.includes('not found')) {
      return 'notfound'
    }
    if (errorName.includes('timeout') || errorMessage.includes('timeout')) {
      return 'timeout'
    }
    return 'unknown'
  }

  private getUserFriendlyMessage(error: Error, errorType: string): string {
    switch (errorType) {
      case 'network':
        return '네트워크 연결에 문제가 발생했습니다. 인터넷 연결을 확인해주세요.'
      case 'auth':
        return '인증에 실패했습니다. 다시 로그인해주세요.'
      case 'validation':
        return '입력한 데이터가 올바르지 않습니다. 확인 후 다시 시도해주세요.'
      case 'notfound':
        return '요청한 데이터를 찾을 수 없습니다.'
      case 'timeout':
        return '요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.'
      default:
        return '예기치 않은 오류가 발생했습니다. 문제가 지속되면 관리자에게 문의해주세요.'
    }
  }
}

/**
 * Higher-order component for module error boundary
 */
export function withModuleErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  moduleName: string,
  fallback?: ReactNode
) {
  return function WithModuleErrorBoundaryComponent(props: P) {
    return (
      <ModuleErrorBoundary moduleName={moduleName} fallback={fallback}>
        <Component {...props} />
      </ModuleErrorBoundary>
    )
  }
}