'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function SalesHistoryError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // 에러 로깅 (프로덕션에서는 에러 모니터링 서비스로 전송)
    console.error('Sales history page error:', error)
  }, [error])

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-4">
          판매 내역 페이지 오류
        </h2>
        <p className="text-gray-600 mb-6">
          판매 데이터를 불러오는 중 오류가 발생했습니다.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <details className="mb-6 text-left">
            <summary className="cursor-pointer text-sm text-gray-500">
              오류 상세 정보 (개발 환경에서만 표시)
            </summary>
            <pre className="mt-2 p-4 bg-gray-100 rounded text-xs overflow-auto">
              {error.message}
              {error.stack}
            </pre>
          </details>
        )}
        <div className="space-x-4">
          <Button
            onClick={reset}
            className="bg-bagel-yellow hover:bg-bagel-yellow-dark"
          >
            다시 시도
          </Button>
          <Button
            variant="outline"
            onClick={() => window.location.href = '/dashboard'}
          >
            대시보드로 이동
          </Button>
        </div>
      </div>
    </div>
  )
}