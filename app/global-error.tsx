'use client'

import { useEffect } from 'react'
import { logger } from '@/lib/logging/logger'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // 에러 로깅
    logger.error('Global error occurred', {
      error: error,
      metadata: {
        message: error.message,
        stack: error.stack,
        digest: error.digest,
      }
    })
  }, [error])

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full space-y-8 p-8">
            <div className="text-center">
              <h1 className="text-6xl font-bold text-gray-900 mb-4">500</h1>
              <h2 className="text-2xl font-semibold text-gray-700 mb-2">
                시스템 오류가 발생했습니다
              </h2>
              <p className="text-gray-700 mb-8">
                예기치 않은 오류가 발생했습니다. 
                문제가 지속되면 관리자에게 문의해주세요.
              </p>
              
              {process.env.NODE_ENV === 'development' && (
                <div className="mb-8 p-4 bg-red-50 rounded-lg text-left">
                  <p className="text-sm font-mono text-red-800">
                    {error.message}
                  </p>
                  {error.digest && (
                    <p className="text-xs text-red-600 mt-2">
                      Error ID: {error.digest}
                    </p>
                  )}
                </div>
              )}
              
              <button
                onClick={reset}
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                다시 시도
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}