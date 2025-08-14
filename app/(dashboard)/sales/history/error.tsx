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
    // 에러 로깅 - digest 포함하여 로깅
    console.error('[Sales History Error Boundary]:', {
      message: error?.message,
      digest: error?.digest,
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    })
  }, [error])

  const isDevelopment = process.env.NODE_ENV === 'development'

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow p-8">
        <h2 className="text-2xl font-bold text-red-600 mb-4 text-center">
          판매 내역 페이지 오류
        </h2>
        
        {isDevelopment ? (
          // 개발 환경: 상세 에러 표시
          <div className="space-y-4">
            <div className="bg-red-50 rounded p-4">
              <h3 className="font-semibold text-red-700 mb-2">오류 메시지:</h3>
              <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                {error?.message || '알 수 없는 오류'}
              </pre>
            </div>
            {error?.stack && (
              <details className="bg-gray-50 rounded p-4">
                <summary className="font-semibold text-gray-700 cursor-pointer">
                  스택 트레이스
                </summary>
                <pre className="mt-2 text-xs text-gray-600 whitespace-pre-wrap overflow-x-auto">
                  {error.stack}
                </pre>
              </details>
            )}
          </div>
        ) : (
          // 프로덕션 환경: 간단한 메시지와 digest
          <div className="text-center">
            <p className="text-gray-700 mb-6">
              판매 내역을 불러오는 중 오류가 발생했습니다.
            </p>
            {error?.digest && (
              <div className="bg-gray-50 rounded p-4 mb-6 inline-block">
                <p className="text-sm text-gray-700 mb-1">오류 코드:</p>
                <code className="text-sm font-mono text-red-600">
                  {error.digest}
                </code>
                <p className="text-xs text-gray-700 mt-2">
                  관리자에게 이 코드를 전달해주세요
                </p>
              </div>
            )}
          </div>
        )}
        
        <div className="flex justify-center gap-4 mt-6">
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