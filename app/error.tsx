'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { logger } from '@/lib/logging/logger'
import { getClientErrorMessage } from '@/lib/errors/handler'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    // 에러 로깅
    logger.error('Application error occurred', {
      error: error,
      metadata: {
        message: error.message,
        stack: error.stack,
        digest: error.digest,
      }
    })
  }, [error])

  const errorMessage = getClientErrorMessage(error)

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            오류가 발생했습니다
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            {errorMessage}
          </p>
          
          {process.env.NODE_ENV === 'development' && error.stack && (
            <details className="mb-8 text-left">
              <summary className="cursor-pointer text-sm text-gray-700 hover:text-gray-700">
                개발자 정보 보기
              </summary>
              <pre className="mt-2 p-4 bg-gray-100 rounded-lg text-xs overflow-auto">
                {error.stack}
              </pre>
              {error.digest && (
                <p className="text-xs text-gray-700 mt-2">
                  Error ID: {error.digest}
                </p>
              )}
            </details>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            다시 시도
          </button>
          
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            홈으로 가기
          </button>
        </div>

        <p className="text-sm text-gray-700 mt-8">
          문제가 계속되면 관리자에게 문의해주세요.
        </p>
      </div>
    </div>
  )
}