'use client'

import { useEffect } from 'react'
import { AlertCircle, RefreshCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

export default function ProductsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()
  
  useEffect(() => {
    console.error('Products page error:', error)
  }, [error])

  return (
    <div className="min-h-[600px] flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            상품 페이지 오류
          </h2>
          
          <p className="text-gray-600 mb-6">
            상품 데이터를 불러오는 중 오류가 발생했습니다.
            {error.message && (
              <span className="block mt-2 text-sm text-gray-500">
                {error.message}
              </span>
            )}
          </p>
          
          <div className="flex gap-3">
            <Button
              onClick={() => reset()}
              className="bg-bagel-yellow hover:bg-yellow-600 text-black"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              다시 시도
            </Button>
            
            <Button
              onClick={() => router.push('/dashboard')}
              variant="outline"
            >
              <Home className="h-4 w-4 mr-2" />
              대시보드로
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}