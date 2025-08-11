'use client'

import { useState, useTransition } from 'react'
import React from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Calendar, Filter, X, ChevronDown, ChevronUp, Building2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StoreSelector } from '@/components/ui/store-selector'
import { cancelSale } from '@/lib/actions/sales.actions'
import type { SaleTransaction } from '@/lib/data/sales.data'

interface SalesHistoryClientProps {
  initialTransactions: SaleTransaction[]
  initialStats: {
    count: number
    totalAmount: number
    cancelledCount: number
  }
  user: {
    role: string
    storeId: string | null
    storeName: string
    organizationId: string | null
    organizationName: string
    canCancelSale: boolean
  }
  filters: {
    startDate: string
    endDate: string
    storeId: string | null
    paymentMethod: string
    status: string
  }
}

export default function SalesHistoryClient({
  initialTransactions,
  initialStats,
  user,
  filters: initialFilters
}: SalesHistoryClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [expandedSales, setExpandedSales] = useState<Set<string>>(new Set())
  
  // 필터 상태
  const [startDate, setStartDate] = useState(initialFilters.startDate)
  const [endDate, setEndDate] = useState(initialFilters.endDate)
  const [paymentMethod, setPaymentMethod] = useState(initialFilters.paymentMethod)
  const [status, setStatus] = useState(initialFilters.status)
  const [selectedStoreId, setSelectedStoreId] = useState(initialFilters.storeId)
  
  // 필터 적용
  const handleFilter = () => {
    startTransition(() => {
      const params = new URLSearchParams()
      params.set('start', startDate)
      params.set('end', endDate)
      if (paymentMethod) params.set('payment', paymentMethod)
      if (status) params.set('status', status)
      if (selectedStoreId && (user.role === 'super_admin' || user.role === 'admin')) {
        params.set('storeId', selectedStoreId)
      }
      
      router.push(`/sales/history?${params.toString()}`)
    })
  }
  
  // 새로고침
  const handleRefresh = () => {
    startTransition(() => {
      router.refresh()
    })
  }
  
  // 판매 취소
  const handleCancelSale = async (transactionId: string) => {
    const reason = prompt('취소 사유를 입력하세요:')
    if (!reason) return
    
    if (!confirm('정말로 이 판매를 취소하시겠습니까?')) return
    
    startTransition(async () => {
      const result = await cancelSale(transactionId)
      
      if (result.success) {
        alert(result.message)
        router.refresh()
      } else {
        alert(result.error)
      }
    })
  }
  
  // 상세 정보 토글
  const toggleExpanded = (saleId: string) => {
    const newExpanded = new Set(expandedSales)
    if (newExpanded.has(saleId)) {
      newExpanded.delete(saleId)
    } else {
      newExpanded.add(saleId)
    }
    setExpandedSales(newExpanded)
  }
  
  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      cash: '현금',
      card: '카드',
      transfer: '계좌이체',
      mobile: '모바일결제',
      other: '기타'
    }
    return labels[method] || method
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-black">판매 내역</h1>
          <p className="text-black mt-2">
            {user.storeName ? `${user.storeName} - ` : ''}판매 기록을 조회하고 관리합니다.
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

      {/* 매장 선택 (관리자만) */}
      {(user.role === 'super_admin' || user.role === 'admin') && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center gap-4">
            <Building2 className="h-5 w-5 text-black" />
            <span className="text-sm font-medium text-black">매장 선택:</span>
            <div className="flex-1 max-w-md">
              <StoreSelector
                selectedStoreId={selectedStoreId}
                onStoreChange={(newStoreId, newStoreName) => {
                  setSelectedStoreId(newStoreId || null)
                }}
                userRole={user.role}
                showAll={true}
                allLabel="전체 매장"
              />
            </div>
          </div>
        </div>
      )}

      {/* 필터 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-black" />
          <h2 className="text-lg font-semibold">필터</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-black mb-1">
              시작일
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow text-gray-900 bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-black mb-1">
              종료일
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow text-gray-900 bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-black mb-1">
              결제 방법
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow text-gray-900 bg-white"
            >
              <option value="">전체</option>
              <option value="cash">현금</option>
              <option value="card">카드</option>
              <option value="transfer">계좌이체</option>
              <option value="mobile">모바일결제</option>
              <option value="other">기타</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-black mb-1">
              상태
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow text-gray-900 bg-white"
            >
              <option value="">전체</option>
              <option value="completed">완료</option>
              <option value="cancelled">취소</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button
              onClick={handleFilter}
              disabled={isPending}
              className="w-full bg-bagel-yellow hover:bg-yellow-600 text-black"
            >
              조회
            </Button>
          </div>
        </div>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-700">총 판매 건수</h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {initialStats.count.toLocaleString()}건
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-700">총 매출액</h3>
          <p className="text-2xl font-bold text-bagel-yellow mt-2">
            ₩{initialStats.totalAmount.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-700">취소 건수</h3>
          <p className="text-2xl font-bold text-red-600 mt-2">
            {initialStats.cancelledCount.toLocaleString()}건
          </p>
        </div>
      </div>

      {/* 판매 목록 */}
      <div className="bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  일시
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  매장
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  결제방법
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                  금액
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {initialTransactions.map((sale) => (
                <React.Fragment key={sale.id}>
                  <tr className={sale.status === 'cancelled' ? 'bg-gray-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(sale.created_at), 'yyyy-MM-dd HH:mm', { locale: ko })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {sale.stores?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                        {getPaymentMethodLabel(sale.payment_method)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                      <span className={sale.status === 'cancelled' ? 'line-through text-gray-600' : 'text-gray-900'}>
                        ₩{sale.total_amount.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {sale.status === 'cancelled' ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          취소됨
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          완료
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => toggleExpanded(sale.id)}
                          className="text-bagel-yellow hover:text-yellow-600"
                        >
                          {expandedSales.has(sale.id) ? (
                            <ChevronUp className="h-5 w-5" />
                          ) : (
                            <ChevronDown className="h-5 w-5" />
                          )}
                        </button>
                        {user.canCancelSale && sale.status !== 'cancelled' && (
                          <button
                            onClick={() => handleCancelSale(sale.id)}
                            disabled={isPending}
                            className="text-red-600 hover:text-red-900 disabled:opacity-50"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedSales.has(sale.id) && (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 bg-gray-50">
                        <div className="space-y-3">
                          {/* 판매 상세 정보 */}
                          <div className="flex flex-wrap gap-4 text-sm">
                            <div>
                              <span className="font-medium text-gray-700">판매자:</span>{' '}
                              <span className="text-gray-900">{sale.profiles?.full_name || '알 수 없음'}</span>
                            </div>
                            {sale.customer_name && (
                              <div>
                                <span className="font-medium text-gray-700">고객명:</span>{' '}
                                <span className="text-gray-900">{sale.customer_name}</span>
                              </div>
                            )}
                            {sale.cancelled_at && (
                              <div>
                                <span className="font-medium text-gray-700">취소일시:</span>{' '}
                                <span className="text-gray-900">
                                  {format(new Date(sale.cancelled_at), 'yyyy-MM-dd HH:mm', { locale: ko })}
                                </span>
                              </div>
                            )}
                            {sale.cancelled_reason && (
                              <div>
                                <span className="font-medium text-gray-700">취소사유:</span>{' '}
                                <span className="text-gray-900">{sale.cancelled_reason}</span>
                              </div>
                            )}
                          </div>

                          {/* 판매 항목 */}
                          {sale.sales_items && sale.sales_items.length > 0 && (
                            <div>
                              <h4 className="font-medium text-gray-900 mb-2">판매 항목</h4>
                              <div className="bg-white rounded border">
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">상품명</th>
                                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-700">수량</th>
                                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-700">단가</th>
                                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-700">금액</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200">
                                    {sale.sales_items.map((item) => (
                                      <tr key={item.id}>
                                        <td className="px-4 py-2 text-sm text-gray-900">
                                          {item.products?.name || '알 수 없는 상품'}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-center text-gray-900">
                                          {item.quantity}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-right text-gray-900">
                                          ₩{item.unit_price.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-right font-medium text-gray-900">
                                          ₩{item.subtotal.toLocaleString()}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {initialTransactions.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-700">조회 결과가 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  )
}