'use client'

import { useState } from 'react'
import { 
  TrendingUp, 
  TrendingDown, 
  Store, 
  Calendar, 
  DollarSign,
  Users,
  RefreshCw,
  BarChart3,
  Clock
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SalesData {
  store: {
    id: string
    name: string
    code: string
    address?: string
  }
  current_month: {
    total: number
    count: number
    average_transaction: number
    period: string
  }
  previous_month: {
    total: number
    count: number
    period: string
  }
  comparison: {
    change_amount: number
    change_percentage: number
    is_increase: boolean
  }
  today: {
    total: number
    count: number
  }
  trend: Array<{
    month: string
    total: number
    count: number
  }>
  generated_at: string
}

interface MobileSalesCardProps {
  salesData: SalesData
  onRefresh?: () => void
  loading?: boolean
}

/**
 * Mobile-optimized sales card component
 * Displays store sales data in a touch-friendly format
 */
export function MobileSalesCard({ salesData, onRefresh, loading = false }: MobileSalesCardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'trend'>('overview')

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ko-KR').format(num)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const maxTrendValue = Math.max(...salesData.trend.map(item => item.total))

  return (
    <div className="w-full bg-white rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-bagel-yellow to-yellow-400 px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Store className="h-6 w-6 text-bagel-black mr-3" />
            <div>
              <h2 className="text-lg font-bold text-bagel-black">
                {salesData.store.name}
              </h2>
              <p className="text-sm text-bagel-black opacity-80">
                매장코드: {salesData.store.code}
              </p>
            </div>
          </div>
          
          {onRefresh && (
            <Button
              onClick={onRefresh}
              variant="ghost"
              size="sm"
              disabled={loading}
              className="text-bagel-black hover:bg-white/20 min-h-[36px] touch-manipulation"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 py-3 px-4 text-sm font-medium text-center min-h-[44px] touch-manipulation ${
            activeTab === 'overview'
              ? 'text-bagel-black border-b-2 border-bagel-yellow bg-yellow-50'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          매출 현황
        </button>
        <button
          onClick={() => setActiveTab('trend')}
          className={`flex-1 py-3 px-4 text-sm font-medium text-center min-h-[44px] touch-manipulation ${
            activeTab === 'trend'
              ? 'text-bagel-black border-b-2 border-bagel-yellow bg-yellow-50'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          6개월 트렌드
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'overview' ? (
          <div className="space-y-6">
            {/* Today's Sales */}
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-blue-800 flex items-center">
                  <Clock className="h-4 w-4 mr-2" />
                  오늘 매출
                </h3>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-2xl font-bold text-blue-900">
                    {formatCurrency(salesData.today.total)}
                  </p>
                  <p className="text-sm text-blue-700">
                    {salesData.today.count}건의 거래
                  </p>
                </div>
              </div>
            </div>

            {/* Current Month */}
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-green-800 flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  이번 달 매출 ({salesData.current_month.period})
                </h3>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-3xl font-bold text-green-900">
                    {formatCurrency(salesData.current_month.total)}
                  </p>
                  <div className="flex items-center mt-2 space-x-4">
                    <span className="text-sm text-green-700 flex items-center">
                      <Users className="h-3 w-3 mr-1" />
                      {formatNumber(salesData.current_month.count)}건
                    </span>
                    <span className="text-sm text-green-700 flex items-center">
                      <DollarSign className="h-3 w-3 mr-1" />
                      평균 {formatCurrency(salesData.current_month.average_transaction)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Comparison with Previous Month */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">
                전월 대비 ({salesData.previous_month.period})
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">전월 매출</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatCurrency(salesData.previous_month.total)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatNumber(salesData.previous_month.count)}건
                  </p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600 mb-1">증감률</p>
                  <div className="flex items-center">
                    {salesData.comparison.is_increase ? (
                      <TrendingUp className="h-5 w-5 text-green-500 mr-1" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-500 mr-1" />
                    )}
                    <span className={`text-lg font-semibold ${
                      salesData.comparison.is_increase ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {salesData.comparison.change_percentage > 0 ? '+' : ''}
                      {salesData.comparison.change_percentage.toFixed(1)}%
                    </span>
                  </div>
                  <p className={`text-xs ${
                    salesData.comparison.is_increase ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {salesData.comparison.change_amount > 0 ? '+' : ''}
                    {formatCurrency(salesData.comparison.change_amount)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Trend Tab */
          <div className="space-y-4">
            <div className="flex items-center mb-4">
              <BarChart3 className="h-5 w-5 text-gray-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">6개월 매출 트렌드</h3>
            </div>
            
            {/* Simple Bar Chart */}
            <div className="space-y-3">
              {salesData.trend.map((item, index) => {
                const barHeight = maxTrendValue > 0 ? (item.total / maxTrendValue) * 100 : 0
                const isCurrentMonth = index === salesData.trend.length - 1
                
                return (
                  <div key={item.month} className="space-y-2">
                    <div className="flex justify-between items-end">
                      <span className={`text-sm font-medium ${
                        isCurrentMonth ? 'text-bagel-black' : 'text-gray-600'
                      }`}>
                        {item.month}
                      </span>
                      <span className={`text-sm ${
                        isCurrentMonth ? 'text-bagel-black font-semibold' : 'text-gray-600'
                      }`}>
                        {formatCurrency(item.total)}
                      </span>
                    </div>
                    
                    <div className="w-full bg-gray-200 rounded-full h-6 relative overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isCurrentMonth 
                            ? 'bg-gradient-to-r from-bagel-yellow to-yellow-400' 
                            : 'bg-gradient-to-r from-gray-400 to-gray-500'
                        }`}
                        style={{ width: `${Math.max(barHeight, 2)}%` }}
                      />
                      <div className="absolute inset-0 flex items-center px-2">
                        <span className="text-xs text-white font-medium">
                          {item.count}건
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            
            {/* Trend Summary */}
            <div className="mt-6 bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-800 mb-2">트렌드 요약</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">최고 매출</p>
                  <p className="font-semibold text-gray-900">
                    {formatCurrency(Math.max(...salesData.trend.map(item => item.total)))}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">평균 매출</p>
                  <p className="font-semibold text-gray-900">
                    {formatCurrency(
                      salesData.trend.reduce((sum, item) => sum + item.total, 0) / salesData.trend.length
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">
          마지막 업데이트: {formatDate(salesData.generated_at)}
        </p>
      </div>
    </div>
  )
}