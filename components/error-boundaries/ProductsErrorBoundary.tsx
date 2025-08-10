/**
 * Products Error Boundary
 * 상품 모듈 전용 Error Boundary
 */

'use client'

import React from 'react'
import { ModuleErrorBoundary } from './ModuleErrorBoundary'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Package, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: React.ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

export function ProductsErrorBoundary({ children, onError }: Props) {
  const fallback = (
    <div className="p-8">
      <Alert variant="destructive" className="max-w-2xl mx-auto">
        <Package className="h-4 w-4" />
        <AlertDescription className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-semibold">상품 시스템 오류</span>
          </div>
          
          <p>상품 처리 중 문제가 발생했습니다.</p>
          
          <div className="space-y-2 text-sm">
            <p className="font-medium">다음 사항을 확인해주세요:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>상품 정보가 올바른지 확인</li>
              <li>SKU가 중복되지 않았는지 확인</li>
              <li>가격 정보가 정확한지 확인</li>
              <li>재고 수량이 올바른지 확인</li>
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
              onClick={() => window.location.href = '/dashboard/products'}
              variant="outline"
              size="sm"
            >
              상품 목록으로
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  )

  return (
    <ModuleErrorBoundary
      moduleName="Products"
      fallback={fallback}
      onError={(error, errorInfo) => {
        // Log products-specific error metrics
        console.error('Products module error:', {
          error: error.message,
          stack: error.stack,
          component: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
          module: 'products'
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
                name: 'products',
                component: 'ProductsErrorBoundary'
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
 * HOC for wrapping components with Products error boundary
 */
export function withProductsErrorBoundary<P extends object>(
  Component: React.ComponentType<P>
) {
  return function WithProductsErrorBoundaryComponent(props: P) {
    return (
      <ProductsErrorBoundary>
        <Component {...props} />
      </ProductsErrorBoundary>
    )
  }
}