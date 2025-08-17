'use client'

import { useState, useTransition } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { 
  BarChart3, 
  TrendingUp, 
  Calendar,
  Package,
  DollarSign,
  CreditCard,
  Smartphone,
  RefreshCw,
  Building2,
  TrendingDown
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import HourlySalesComparison from '@/components/sales/HourlySalesComparison'
import type { SalesSummaryData, HourlySalesData } from '@/lib/data/sales.data'

interface SalesSummaryClientProps {
  initialData: SalesSummaryData
  comparison?: {
    current: SalesSummaryData
    previous: SalesSummaryData
    growth: {
      sales: number
      transactions: number
    }
  }
  hourlySalesData?: HourlySalesData[] | null
  storeId: string | null
  storeName: string
  dateRange: {
    start: string
    end: string
  }
}

// 차트 컴포넌트
const SimpleBarChart = ({ data, dataKey, color = '#FDB813' }: any) => {
  const maxValue = Math.max(...data.map((d: any) => d[dataKey]))
  
  return (
    <div className="space-y-2">
      {data.map((item: any, index: number) => (
        <div key={index} className="flex items-center gap-3">
          <div className="w-20 text-sm text-black font-medium">{item.label}</div>
          <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
            <div
              className="absolute left-0 top-0 h-full rounded-full transition-all"
              style={{
                width: `${(item[dataKey] / maxValue) * 100}%`,
                backgroundColor: color
              }}
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-black">
              ₩{item[dataKey].toLocaleString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function SalesSummaryClient({
  initialData,
  comparison,
  hourlySalesData,
  storeId,
  storeName,
  dateRange
}: SalesSummaryClientProps) {
  const [isPending, startTransition] = useTransition()
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day')
  
  const handlePeriodChange = (newPeriod: 'day' | 'week' | 'month') => {
    startTransition(() => {
      setPeriod(newPeriod)
      // Server Action을 통해 데이터 새로고침
      // router.refresh() 대신 Server Action 사용
    })
  }
  
  const handleRefresh = () => {
    startTransition(() => {
      // Server Action을 통해 캐시 무효화 및 새로고침
      window.location.reload()
    })
  }
  
  // 차트 데이터 준비
  const chartData = initialData.dailySales.slice(-7).map(day => ({
    label: format(new Date(day.date), 'MM/dd', { locale: ko }),
    sales: day.total
  }))
  
  const paymentChartData = [
    { label: '현금', amount: initialData.paymentMethods.cash },
    { label: '카드', amount: initialData.paymentMethods.card },
    { label: '모바일', amount: initialData.paymentMethods.mobile }
  ]
  
  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">매출 요약</h1>
          <p className="text-sm text-black mt-1">
            {storeName} | {format(new Date(dateRange.start), 'yyyy년 MM월 dd일', { locale: ko })} 
            ~ {format(new Date(dateRange.end), 'yyyy년 MM월 dd일', { locale: ko })}
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={isPending}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isPending ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      </div>
      
      {/* 기간 선택 */}
      <div className="flex gap-2">
        {(['day', 'week', 'month'] as const).map((p) => (
          <Button
            key={p}
            variant={period === p ? 'primary' : 'outline'}
            size="sm"
            onClick={() => handlePeriodChange(p)}
            disabled={isPending}
          >
            {p === 'day' ? '일간' : p === 'week' ? '주간' : '월간'}
          </Button>
        ))}
      </div>
      
      {/* 주요 지표 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black font-medium">총 매출</p>
              <p className="text-2xl font-bold text-black">₩{initialData.totalSales.toLocaleString()}</p>
              {comparison && (
                <p className={`text-sm mt-1 flex items-center ${
                  comparison.growth.sales >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {comparison.growth.sales >= 0 ? (
                    <TrendingUp className="h-4 w-4 mr-1" />
                  ) : (
                    <TrendingDown className="h-4 w-4 mr-1" />
                  )}
                  {Math.abs(comparison.growth.sales).toFixed(1)}%
                </p>
              )}
            </div>
            <DollarSign className="h-8 w-8 text-yellow-500" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black font-medium">거래 수</p>
              <p className="text-2xl font-bold text-black">{initialData.transactionCount}</p>
              {comparison && (
                <p className={`text-sm mt-1 flex items-center ${
                  comparison.growth.transactions >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {comparison.growth.transactions >= 0 ? (
                    <TrendingUp className="h-4 w-4 mr-1" />
                  ) : (
                    <TrendingDown className="h-4 w-4 mr-1" />
                  )}
                  {Math.abs(comparison.growth.transactions).toFixed(1)}%
                </p>
              )}
            </div>
            <BarChart3 className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black font-medium">평균 거래액</p>
              <p className="text-2xl font-bold text-black">₩{Math.round(initialData.averageTransaction).toLocaleString()}</p>
            </div>
            <CreditCard className="h-8 w-8 text-green-500" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black font-medium">인기 상품</p>
              <p className="text-lg font-semibold text-black">
                {initialData.topProducts[0]?.name || '없음'}
              </p>
              <p className="text-sm text-black">
                {initialData.topProducts[0]?.quantity || 0}개 판매
              </p>
            </div>
            <Package className="h-8 w-8 text-purple-500" />
          </div>
        </div>
      </div>
      
      {/* 시간별 매출 비교 섹션 */}
      {period === 'day' && (
        <HourlySalesComparison 
          storeId={storeId} 
          selectedDate={new Date(dateRange.end)}
          initialData={hourlySalesData || undefined}
        />
      )}
      
      {/* 차트 섹션 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 일별 매출 차트 */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-black mb-4">일별 매출 추이</h3>
          <SimpleBarChart data={chartData} dataKey="sales" />
        </div>
        
        {/* 결제 방법별 매출 */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-black mb-4">결제 방법별 매출</h3>
          <SimpleBarChart data={paymentChartData} dataKey="amount" color="#3B82F6" />
        </div>
      </div>
      
      {/* 인기 상품 TOP 5 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-black mb-4">인기 상품 TOP 5</h3>
        <div className="space-y-3">
          {initialData.topProducts.map((product, index) => (
            <div key={product.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 bg-yellow-500 text-white rounded-full flex items-center justify-center font-bold">
                  {index + 1}
                </span>
                <div>
                  <p className="font-medium text-black">{product.name}</p>
                  <p className="text-sm text-black">{product.quantity}개 판매</p>
                </div>
              </div>
              <p className="font-semibold text-black">₩{product.revenue.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}