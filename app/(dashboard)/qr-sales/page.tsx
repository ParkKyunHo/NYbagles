import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { QRSalesScanner } from '@/components/qr/QRSalesScanner'
import LoadingSpinner from '@/components/common/LoadingSpinner'

/**
 * QR Sales Scanning Page - Admin Only
 * Allows admins to scan store QR codes and view sales data
 */
export default async function QRSalesPage() {
  const supabase = await createClient()
  
  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/login')
  }

  // Check if user is admin
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    redirect('/dashboard')
  }

  // Only admins and super_admins can access this page
  if (!['admin', 'super_admin'].includes(profile.role)) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            매장 매출 조회
          </h1>
          <p className="text-gray-600 text-sm">
            매장 QR 코드를 스캔하여 매출 현황을 확인하세요
          </p>
        </div>

        {/* QR Scanner */}
        <Suspense fallback={
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner />
          </div>
        }>
          <QRSalesScanner />
        </Suspense>

        {/* Instructions */}
        <div className="mt-8 bg-white rounded-lg p-4 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-3">사용 방법</h3>
          <ol className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start">
              <span className="flex-shrink-0 w-5 h-5 bg-bagel-yellow text-bagel-black rounded-full text-xs font-semibold flex items-center justify-center mr-3 mt-0.5">
                1
              </span>
              <span>상단의 &quot;QR 코드 스캔 시작&quot; 버튼을 눌러주세요</span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-5 h-5 bg-bagel-yellow text-bagel-black rounded-full text-xs font-semibold flex items-center justify-center mr-3 mt-0.5">
                2
              </span>
              <span>매장의 QR 코드를 카메라 화면 중앙에 맞춰주세요</span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-5 h-5 bg-bagel-yellow text-bagel-black rounded-full text-xs font-semibold flex items-center justify-center mr-3 mt-0.5">
                3
              </span>
              <span>매출 정보가 자동으로 표시됩니다</span>
            </li>
          </ol>
          
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xs text-yellow-800">
              <strong>참고:</strong> 이 기능은 관리자만 사용할 수 있으며, 
              카메라 권한이 필요합니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}