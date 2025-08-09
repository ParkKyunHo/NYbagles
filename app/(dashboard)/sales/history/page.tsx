import { Suspense } from 'react'
import { requireRole } from '@/lib/auth/server-auth'
import { getSalesHistory } from '@/lib/data/sales.data'
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
  // 권한 체크 및 사용자 정보 가져오기
  const user = await requireRole(['super_admin', 'admin', 'manager', 'employee'])
  
  // 날짜 범위 설정 (기본값: 오늘)
  const today = format(new Date(), 'yyyy-MM-dd')
  const startDate = searchParams.start || today
  const endDate = searchParams.end || today
  
  // 매장 ID 결정
  // super_admin, admin은 모든 매장 조회 가능
  // manager, employee는 자신의 매장만 조회 가능
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
  const { transactions, stats } = await getSalesHistory(filters)
  
  // 매장 정보
  const storeName = storeId 
    ? user.storeName || '매장' 
    : '전체 매장'
  
  // 사용자가 판매 취소 권한이 있는지 확인
  const canCancelSale = ['super_admin', 'admin', 'manager'].includes(user.role)
  
  return (
    <Suspense fallback={<SalesHistoryLoading />}>
      <SalesHistoryClient
        initialTransactions={transactions}
        initialStats={stats}
        user={{
          role: user.role,
          storeId: user.storeId || null,
          storeName: user.storeName || '',
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
}