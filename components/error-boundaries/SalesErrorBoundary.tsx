/**
 * Sales Error Boundary
 * 판매 모듈 전용 Error Boundary
 */

'use client'

import React from 'react'
import { ModuleErrorBoundary } from './ModuleErrorBoundary'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ShoppingCart, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: React.ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

export function SalesErrorBoundary({ children, onError }: Props) {
  const fallback = (
    <div className="p-8">
      <Alert variant="destructive" className="max-w-2xl mx-auto">
        <ShoppingCart className="h-4 w-4" />
        <AlertDescription className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-semibold">판매 시스템 오류</span>
          </div>
          
          <p>판매 처리 중 문제가 발생했습니다.</p>
          
          <div className="space-y-2 text-sm">
            <p className="font-medium">다음 사항을 확인해주세요:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>상품 재고가 충분한지 확인</li>
              <li>고객 정보가 올바른지 확인</li>
              <li>결제 정보가 정확한지 확인</li>
              <li>네트워크 연결 상태 확인</li>
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
              onClick={() => window.location.href = '/dashboard/sales'}
              variant="outline"
              size="sm"
            >
              판매 목록으로
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  )

  return (
    <ModuleErrorBoundary
      moduleName="Sales"
      fallback={fallback}
      onError={(error, errorInfo) => {
        // Log sales-specific error metrics
        console.error('Sales module error:', {
          error: error.message,
          stack: error.stack,
          component: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
          module: 'sales'
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
                name: 'sales',
                component: 'SalesErrorBoundary'
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
 * HOC for wrapping components with Sales error boundary
 */
export function withSalesErrorBoundary<P extends object>(
  Component: React.ComponentType<P>
) {
  return function WithSalesErrorBoundaryComponent(props: P) {
    return (
      <SalesErrorBoundary>
        <Component {...props} />
      </SalesErrorBoundary>
    )
  }
}