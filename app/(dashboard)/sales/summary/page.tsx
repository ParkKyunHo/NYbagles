'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { salesService } from '@/lib/services/sales.service'
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import { ko } from 'date-fns/locale'
import { 
  BarChart3, 
  TrendingUp, 
  Calendar,
  Package,
  DollarSign,
  CreditCard,
  Smartphone,
  RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PopularProduct, DailySalesSummary, AggregatedSummary } from '@/types/sales'

// 차트 컴포넌트 (recharts 대신 간단한 막대 차트)
const SimpleBarChart = ({ data, dataKey, color = '#FDB813' }: any) => {
  const maxValue = Math.max(...data.map((d: any) => d[dataKey]))
  
  return (
    <div className="space-y-2">
      {data.map((item: any, index: number) => (
        <div key={index} className="flex items-center gap-3">
          <div className="w-20 text-sm text-gray-600">{item.label}</div>
          <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
            <div
              className="absolute left-0 top-0 h-full rounded-full transition-all"
              style={{
                width: `${(item[dataKey] / maxValue) * 100}%`,
                backgroundColor: color
              }}
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium">
              ₩{item[dataKey].toLocaleString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function SalesSummaryPage() {
  const [summaryData, setSummaryData] = useState<any>(null)
  const [popularProducts, setPopularProducts] = useState<PopularProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day')
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 6), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  })
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (period) {
      updateDateRange()
    }
  }, [period])

  useEffect(() => {
    fetchData()
  }, [dateRange])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/login')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['super_admin', 'admin', 'manager'].includes(profile.role)) {
      router.push('/dashboard')
      return
    }
  }

  const updateDateRange = () => {
    const now = new Date()
    let start: Date
    let end: Date = now

    switch (period) {
      case 'day':
        start = subDays(now, 6)
        break
      case 'week':
        start = startOfWeek(subDays(now, 28), { weekStartsOn: 1 })
        end = endOfWeek(now, { weekStartsOn: 1 })
        break
      case 'month':
        start = startOfMonth(subDays(now, 90))
        end = endOfMonth(now)
        break
    }

    setDateRange({
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd')
    })
  }

  const fetchData = async () => {
    setLoading(true)
    
    try {
      // 매출 요약 데이터
      const summaryResult = await salesService.getSalesSummary({
        start_date: dateRange.start,
        end_date: dateRange.end,
        group_by: period
      })

      if (summaryResult.success && summaryResult.data) {
        setSummaryData(summaryResult.data)
      }

      // 인기 상품 데이터
      const productsResult = await salesService.getPopularProducts({
        period: period === 'day' ? 'week' : 'month',
        limit: 10
      })

      if (productsResult.success && productsResult.data) {
        setPopularProducts(productsResult.data)
      }
    } catch (error) {
      console.error('Error fetching summary data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatChartData = () => {
    if (!summaryData?.summaries) return []

    return summaryData.summaries.map((item: DailySalesSummary | AggregatedSummary) => {
      let label = ''
      
      if ('sale_date' in item) {
        label = format(new Date(item.sale_date), 'MM/dd')
      } else if ('period' in item) {
        if (period === 'week') {
          label = `${item.period} 주`
        } else {
          label = format(new Date(item.period + '-01'), 'yy년 MM월')
        }
      }

      return {
        label,
        total_sales: item.total_sales || 0,
        cash_sales: item.cash_sales || 0,
        card_sales: item.card_sales || 0
      }
    }).slice(-7) // 최근 7개만 표시
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bagel-yellow mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  const stats = summaryData?.total_stats || {
    total_sales: 0,
    cash_sales: 0,
    card_sales: 0,
    other_sales: 0,
    transaction_count: 0,
    daily_average: 0
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">매출 요약</h1>
          <p className="text-gray-600 mt-2">매출 통계와 분석 데이터를 확인합니다.</p>
        </div>
        <Button
          onClick={fetchData}
          variant="secondary"
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          새로고침
        </Button>
      </div>

      {/* 기간 선택 */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center gap-4">
          <Calendar className="h-5 w-5 text-gray-600" />
          <div className="flex gap-2">
            {(['day', 'week', 'month'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-md transition-colors ${
                  period === p
                    ? 'bg-bagel-yellow text-black'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {p === 'day' ? '일별' : p === 'week' ? '주별' : '월별'}
              </button>
            ))}
          </div>
          <div className="ml-auto text-sm text-gray-600">
            {dateRange.start} ~ {dateRange.end}
          </div>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">총 매출</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                ₩{stats.total_sales.toLocaleString()}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">현금 매출</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                ₩{stats.cash_sales.toLocaleString()}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-gray-700" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">카드 매출</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                ₩{stats.card_sales.toLocaleString()}
              </p>
            </div>
            <CreditCard className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">일평균 매출</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                ₩{Math.round(stats.daily_average).toLocaleString()}
              </p>
            </div>
            <BarChart3 className="h-8 w-8 text-bagel-yellow" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 매출 차트 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {period === 'day' ? '일별' : period === 'week' ? '주별' : '월별'} 매출 추이
          </h2>
          <SimpleBarChart 
            data={formatChartData()} 
            dataKey="total_sales"
            color="#FDB813"
          />
        </div>

        {/* 인기 상품 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Package className="h-5 w-5 mr-2" />
            인기 상품 TOP 10
          </h2>
          <div className="space-y-3">
            {popularProducts.map((product, index) => (
              <div key={product.product_id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 bg-bagel-yellow rounded-full flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">{product.product_name}</p>
                    <p className="text-sm text-gray-700">{product.category_name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">
                    {product.total_quantity.toLocaleString()}{product.unit}
                  </p>
                  <p className="text-sm text-gray-700">
                    ₩{product.total_revenue.toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 결제 방법별 매출 */}
      <div className="bg-white rounded-lg shadow p-6 mt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">결제 방법별 매출</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <DollarSign className="h-12 w-12 text-gray-700 mx-auto mb-2" />
            <p className="text-sm text-gray-600">현금</p>
            <p className="text-xl font-bold text-gray-900">
              ₩{stats.cash_sales.toLocaleString()}
            </p>
            <p className="text-sm text-gray-700">
              {stats.total_sales > 0 
                ? `${Math.round((stats.cash_sales / stats.total_sales) * 100)}%`
                : '0%'
              }
            </p>
          </div>
          <div className="text-center">
            <CreditCard className="h-12 w-12 text-blue-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600">카드</p>
            <p className="text-xl font-bold text-gray-900">
              ₩{stats.card_sales.toLocaleString()}
            </p>
            <p className="text-sm text-gray-700">
              {stats.total_sales > 0 
                ? `${Math.round((stats.card_sales / stats.total_sales) * 100)}%`
                : '0%'
              }
            </p>
          </div>
          <div className="text-center">
            <Smartphone className="h-12 w-12 text-purple-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600">기타</p>
            <p className="text-xl font-bold text-gray-900">
              ₩{stats.other_sales.toLocaleString()}
            </p>
            <p className="text-sm text-gray-700">
              {stats.total_sales > 0 
                ? `${Math.round((stats.other_sales / stats.total_sales) * 100)}%`
                : '0%'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}