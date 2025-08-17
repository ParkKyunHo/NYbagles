import { Suspense } from 'react'
import { requireRole } from '@/lib/auth/unified-auth'
import { getSalesSummary, compareSalesPeriods, getHourlySalesComparison } from '@/lib/data/sales.data'
import SalesSummaryClient from './SalesSummaryClient'
import { format, subDays } from 'date-fns'

// 로딩 컴포넌트
function SalesSummaryLoading() {
  return (
    <div className="space-y-6">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white p-6 rounded-lg shadow">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

interface PageProps {
  searchParams: {
    period?: 'day' | 'week' | 'month'
    start?: string
    end?: string
    storeId?: string
  }
}

export default async function SalesSummaryPage({ searchParams }: PageProps) {
  // 권한 체크 및 사용자 정보 가져오기
  const user = await requireRole(['super_admin', 'admin', 'manager'])
  
  // 날짜 범위 계산
  const period = searchParams.period || 'week'
  const today = new Date()
  let startDate: string
  let endDate: string
  
  if (searchParams.start && searchParams.end) {
    startDate = searchParams.start
    endDate = searchParams.end
  } else {
    endDate = format(today, 'yyyy-MM-dd')
    switch (period) {
      case 'day':
        startDate = endDate
        break
      case 'week':
        startDate = format(subDays(today, 6), 'yyyy-MM-dd')
        break
      case 'month':
        startDate = format(subDays(today, 29), 'yyyy-MM-dd')
        break
      default:
        startDate = format(subDays(today, 6), 'yyyy-MM-dd')
    }
  }
  
  // 매장 ID 결정 (슈퍼 관리자는 전체, 매니저는 자기 매장만)
  const storeId = user.role === 'super_admin' || user.role === 'admin' 
    ? searchParams.storeId || null 
    : user.storeId || null
  
  const storeName = storeId 
    ? user.storeName || '매장' 
    : '전체 매장'
  
  // 병렬 데이터 페칭
  const [summaryData, comparisonData, hourlySalesData] = await Promise.all([
    getSalesSummary(storeId, startDate, endDate),
    compareSalesPeriods(storeId, startDate, endDate),
    // 일간 요약일 때만 시간별 데이터 가져오기
    period === 'day' ? getHourlySalesComparison(storeId, endDate) : Promise.resolve(null)
  ])
  
  return (
    <Suspense fallback={<SalesSummaryLoading />}>
      <SalesSummaryClient
        initialData={summaryData}
        comparison={comparisonData}
        hourlySalesData={hourlySalesData}
        storeId={storeId}
        storeName={storeName}
        dateRange={{ start: startDate, end: endDate }}
      />
    </Suspense>
  )
}