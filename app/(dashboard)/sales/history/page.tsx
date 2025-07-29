'use client'

import { useState, useEffect } from 'react'
import React from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { salesService } from '@/lib/services/sales.service'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Calendar, Filter, X, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SaleRecord, PaymentMethod } from '@/types/sales'

export default function SalesHistoryPage() {
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('')
  const [expandedSales, setExpandedSales] = useState<Set<string>>(new Set())
  const [userRole, setUserRole] = useState<string>('')
  const [totalStats, setTotalStats] = useState({
    count: 0,
    amount: 0,
    canceled: 0
  })
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkAuthAndLoadData()
  }, [])

  useEffect(() => {
    if (userRole) {
      fetchSales()
    }
  }, [startDate, endDate, paymentMethod, userRole])

  const checkAuthAndLoadData = async () => {
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

    if (profile) {
      setUserRole(profile.role)
    }
  }

  const fetchSales = async () => {
    setLoading(true)
    
    try {
      const params: any = {
        start_date: startDate,
        end_date: endDate,
        limit: 100
      }

      if (paymentMethod) {
        params.payment_method = paymentMethod
      }

      const response = await salesService.getSales(params)
      setSales(response.data || [])

      // 통계 계산
      const stats = response.data?.reduce((acc, sale) => ({
        count: acc.count + 1,
        amount: acc.amount + (sale.is_canceled ? 0 : sale.total_amount),
        canceled: acc.canceled + (sale.is_canceled ? 1 : 0)
      }), { count: 0, amount: 0, canceled: 0 }) || { count: 0, amount: 0, canceled: 0 }

      setTotalStats(stats)
    } catch (error) {
      console.error('Error fetching sales:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleExpanded = (saleId: string) => {
    const newExpanded = new Set(expandedSales)
    if (newExpanded.has(saleId)) {
      newExpanded.delete(saleId)
    } else {
      newExpanded.add(saleId)
    }
    setExpandedSales(newExpanded)
  }

  const handleCancelSale = async (saleId: string) => {
    const reason = prompt('취소 사유를 입력하세요:')
    if (!reason) return

    if (!confirm('정말로 이 판매를 취소하시겠습니까?')) return

    try {
      const result = await salesService.cancelSale(saleId, reason)
      
      if (result.success) {
        alert('판매가 취소되었습니다.')
        fetchSales()
      } else {
        alert(result.error || '취소 실패')
      }
    } catch (error) {
      console.error('Error canceling sale:', error)
      alert('취소 중 오류가 발생했습니다.')
    }
  }

  const canCancelSale = ['super_admin', 'admin', 'manager'].includes(userRole)

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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">판매 내역</h1>
        <p className="text-gray-600 mt-2">판매 기록을 조회하고 관리합니다.</p>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold">필터</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              결제 방법
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod | '')}
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
          <div className="flex items-end">
            <Button
              onClick={fetchSales}
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
          <h3 className="text-sm font-medium text-gray-500">총 판매 건수</h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {totalStats.count.toLocaleString()}건
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">총 매출액</h3>
          <p className="text-2xl font-bold text-bagel-yellow mt-2">
            ₩{totalStats.amount.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">취소 건수</h3>
          <p className="text-2xl font-bold text-red-600 mt-2">
            {totalStats.canceled.toLocaleString()}건
          </p>
        </div>
      </div>

      {/* 판매 목록 */}
      <div className="bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  일시
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  매장
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  결제방법
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  금액
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sales.map((sale) => (
                <React.Fragment key={sale.id}>
                  <tr className={sale.is_canceled ? 'bg-gray-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(`${sale.sale_date} ${sale.sale_time}`), 'yyyy-MM-dd HH:mm', { locale: ko })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {sale.stores?.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                        {salesService.getPaymentMethodLabel(sale.payment_method)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                      <span className={sale.is_canceled ? 'line-through text-gray-400' : 'text-gray-900'}>
                        ₩{sale.total_amount.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {sale.is_canceled ? (
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
                        {canCancelSale && !sale.is_canceled && (
                          <button
                            onClick={() => handleCancelSale(sale.id)}
                            className="text-red-600 hover:text-red-900"
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
                              <span className="text-gray-900">{sale.profiles?.name || '알 수 없음'}</span>
                            </div>
                            {sale.notes && (
                              <div>
                                <span className="font-medium text-gray-700">메모:</span>{' '}
                                <span className="text-gray-900">{sale.notes}</span>
                              </div>
                            )}
                            {sale.is_canceled && sale.canceled_at && (
                              <div>
                                <span className="font-medium text-gray-700">취소일시:</span>{' '}
                                <span className="text-gray-900">
                                  {format(new Date(sale.canceled_at), 'yyyy-MM-dd HH:mm', { locale: ko })}
                                </span>
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
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">상품명</th>
                                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">수량</th>
                                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">단가</th>
                                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">금액</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200">
                                    {sale.sales_items.map((item) => (
                                      <tr key={item.id}>
                                        <td className="px-4 py-2 text-sm text-gray-900">
                                          {item.products?.name}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-center text-gray-900">
                                          {item.quantity}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-right text-gray-900">
                                          ₩{item.unit_price.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-right font-medium text-gray-900">
                                          ₩{item.total_amount.toLocaleString()}
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

        {sales.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">조회 결과가 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  )
}