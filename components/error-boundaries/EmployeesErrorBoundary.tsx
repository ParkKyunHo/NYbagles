/**
 * Employees Error Boundary
 * 직원 모듈 전용 Error Boundary
 */

'use client'

import React from 'react'
import { ModuleErrorBoundary } from './ModuleErrorBoundary'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Users, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: React.ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

export function EmployeesErrorBoundary({ children, onError }: Props) {
  const fallback = (
    <div className="p-8">
      <Alert variant="destructive" className="max-w-2xl mx-auto">
        <Users className="h-4 w-4" />
        <AlertDescription className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-semibold">직원 시스템 오류</span>
          </div>
          
          <p>직원 정보 처리 중 문제가 발생했습니다.</p>
          
          <div className="space-y-2 text-sm">
            <p className="font-medium">다음 사항을 확인해주세요:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>이메일 주소가 올바른지 확인</li>
              <li>필수 정보가 모두 입력되었는지 확인</li>
              <li>권한 설정이 올바른지 확인</li>
              <li>출퇴근 기록이 정확한지 확인</li>
            </ul>
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button
              onClick={() => window.location.reload()}
              variant="primary"
              size="sm"
            >
              다시 시도
            </Button>
            <Button
              onClick={() => window.location.href = '/dashboard/employees'}
              variant="outline"
              size="sm"
            >
              직원 목록으로
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  )

  return (
    <ModuleErrorBoundary
      moduleName="Employees"
      fallback={fallback}
      onError={(error, errorInfo) => {
        // Log employees-specific error metrics
        console.error('Employees module error:', {
          error: error.message,
          stack: error.stack,
          component: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
          module: 'employees'
        })

        // Call custom error handler
        if (onError) {
          onError(error, errorInfo)
        }

        // Send to monitoring service (if configured)
        if (typeof window !== 'undefined' && (window as any).Sentry) {
          (window as any).Sentry.captureException(error, {
            contexts: {
              module: {
                name: 'employees',
                component: 'EmployeesErrorBoundary'
              }
            }
          })
        }
      }}
    >
      {children}
    </ModuleErrorBoundary>
  )
}

/**
 * HOC for wrapping components with Employees error boundary
 */
export function withEmployeesErrorBoundary<P extends object>(
  Component: React.ComponentType<P>
) {
  return function WithEmployeesErrorBoundaryComponent(props: P) {
    return (
      <EmployeesErrorBoundary>
        <Component {...props} />
      </EmployeesErrorBoundary>
    )
  }
}