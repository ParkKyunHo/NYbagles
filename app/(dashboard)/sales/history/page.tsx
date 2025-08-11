import { Suspense } from 'react'
import { requireRole } from '@/lib/auth/unified-auth'
import { getSalesHistory } from '@/lib/data/sales.data'
import { serializeRows, serializeObject } from '@/lib/utils/serialization'
import { redirect } from 'next/navigation'
import SalesHistoryClient from './SalesHistoryClient'
import { format } from 'date-fns'

// 로딩 컴포넌트
function SalesHistoryLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bagel-yellow mx-auto"></div>
        <p className="mt-4 text-black">판매 내역을 불러오는 중...</p>
      </div>
    </div>
  )
}

interface PageProps {
  searchParams: {
    start?: string
    end?: string
    payment?: string
    status?: string
    storeId?: string
    limit?: string
  }
}

export default async function SalesHistoryPage({ searchParams }: PageProps) {
  try {
    // 권한 체크 및 사용자 정보 가져오기
    const user = await requireRole(['super_admin', 'admin', 'manager', 'employee', 'staff', 'parttimer'])
    
    // 사용자가 승인되지 않은 경우
    if (!user.isApproved) {
      console.log('[Sales History Page] User not approved:', user.email)
      redirect('/pending-approval')
    }
    
    // 조직이 설정되지 않은 경우
    if (!user.organizationId) {
      console.log('[Sales History Page] No organization set for user:', user.email)
      redirect('/select-organization')
    }
  
    // 날짜 범위 설정 (기본값: 오늘)
    const today = format(new Date(), 'yyyy-MM-dd')
    const startDate = searchParams.start || today
    const endDate = searchParams.end || today
    
    // 매장 ID 결정 (Legacy store ID 사용)
    // super_admin, admin은 모든 매장 조회 가능
    // 나머지는 자신의 매장만 조회 가능
    const storeId = user.role === 'super_admin' || user.role === 'admin' 
      ? searchParams.storeId || null 
      : user.storeId || null
    
    // 필터 설정
    const filters = {
      storeId,
      startDate,
      endDate,
      paymentMethod: searchParams.payment,
      status: searchParams.status,
      limit: searchParams.limit ? parseInt(searchParams.limit) : 100
    }
    
    // 데이터 페칭
    const result = await getSalesHistory(filters)
    const transactions = result.transactions || []
    const stats = result.stats || {
      totalAmount: 0,
      totalTransactions: 0,
      averageAmount: 0,
      paymentBreakdown: {}
    }
    
    // 데이터가 없는 경우도 빈 상태로 렌더링
    if (transactions.length === 0) {
      console.log('[Sales History Page] No transactions found for filters:', filters)
    }
  
    // 매장 정보
    const storeName = storeId 
      ? user.storeName || '매장' 
      : '전체 매장'
    
    // 사용자가 판매 취소 권한이 있는지 확인
    const canCancelSale = ['super_admin', 'admin', 'manager'].includes(user.role)
    
    // 데이터 직렬화 (서버 → 클라이언트 전달용)
    const serializedTransactions = serializeRows(transactions)
    const serializedStats = serializeObject(stats)
    
    return (
      <Suspense fallback={<SalesHistoryLoading />}>
        <SalesHistoryClient
          initialTransactions={serializedTransactions}
          initialStats={serializedStats}
          user={{
            role: user.role,
            storeId: user.storeId || null,
            storeName: user.storeName || '',
            organizationId: user.organizationId || null,
            organizationName: user.organizationName || '',
            canCancelSale
          }}
          filters={{
            startDate,
            endDate,
            storeId,
            paymentMethod: searchParams.payment || '',
            status: searchParams.status || ''
          }}
        />
      </Suspense>
    )
  } catch (error: any) {
    console.error('[Sales History Page] Error:', {
      message: error?.message,
      stack: error?.stack,
      code: error?.code
    })
    
    // 인증 실패는 로그인으로
    if (error?.code === 'UNAUTHENTICATED') {
      redirect('/login')
    }
    
    // 권한 없음은 403으로
    if (error?.code === 'UNAUTHORIZED') {
      redirect('/403')
    }
    
    // 그 외 에러는 error boundary로 전달
    throw error
  }
}