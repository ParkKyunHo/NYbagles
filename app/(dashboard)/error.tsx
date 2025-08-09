'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()
  
  useEffect(() => {
    console.error('Dashboard error:', error)
  }, [error])

  const handleLogout = () => {
    localStorage.clear()
    sessionStorage.clear()
    router.push('/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-lg w-full bg-white rounded-lg shadow-xl p-8">
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <AlertTriangle className="h-10 w-10 text-red-600" />
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            시스템 오류
          </h1>
          
          <p className="text-gray-600 mb-2">
            예상치 못한 오류가 발생했습니다.
          </p>
          
          {error.message && (
            <div className="w-full bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-800 font-mono">
                {error.message}
              </p>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-3 w-full">
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
              홈으로
            </Button>
            
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="col-span-1"
            >
              새로고침
            </Button>
            
            <Button
              onClick={handleLogout}
              variant="outline"
              className="col-span-1 text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4 mr-2" />
              로그아웃
            </Button>
          </div>
          
          <p className="text-xs text-gray-500 mt-6">
            문제가 계속되면 관리자에게 문의하세요.
          </p>
        </div>
      </div>
    </div>
  )
}