'use client'

import { useState, useEffect } from 'react'
import React from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Calendar, Filter, X, ChevronDown, ChevronUp, AlertCircle, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StoreSelector } from '@/components/ui/store-selector'

interface SaleTransaction {
  id: string
  store_id: string
  customer_name?: string
  sold_at: string
  total_amount: number
  discount_amount: number
  final_amount: number
  payment_method: string
  payment_status: string
  canceled_at?: string
  canceled_by?: string
  canceled_reason?: string
  sales_items?: Array<{
    id: string
    product_id: string
    quantity: number
    unit_price: number
    total_amount: number
    stock_before: number
    stock_after: number
    product?: {
      id: string
      name: string
    }
  }>
  stores?: {
    id: string
    name: string
  }
  profiles?: {
    full_name: string
  }
}

export default function SalesHistoryPage() {
  const [sales, setSales] = useState<SaleTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [paymentMethod, setPaymentMethod] = useState<string>('')
  const [expandedSales, setExpandedSales] = useState<Set<string>>(new Set())
  const [userRole, setUserRole] = useState<string>('')
  const [storeId, setStoreId] = useState<string | null>(null)
  const [storeName, setStoreName] = useState<string>('')
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
    if (userRole && (storeId || userRole === 'super_admin' || userRole === 'admin')) {
      fetchSales()
    }
  }, [startDate, endDate, paymentMethod, userRole, storeId])

  const checkAuthAndLoadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/login')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, store_id')
      .eq('id', user.id)
      .single()

    if (profile) {
      setUserRole(profile.role)
      
      // 직원/매니저는 자신의 매장만 볼 수 있음
      if (['employee', 'manager'].includes(profile.role) && profile.store_id) {
        const { data: store } = await supabase
          .from('stores')
          .select('id, name')
          .eq('id', profile.store_id)
          .single()

        if (store) {
          setStoreId(store.id)
          setStoreName(store.name)
        }
      }
    }
  }

  const fetchSales = async () => {
    setLoading(true)
    
    try {
      // Build query for sales_transactions
      let query = supabase
        .from('sales_transactions')
        .select(`
          *,
          sales_items (
            *,
            product:products_v3 (
              id,
              name
            )
          ),
          stores (
            id,
            name
          ),
          profiles:sold_by (
            full_name
          )
        `)
        .order('sold_at', { ascending: false })
        .limit(100)

      // Apply filters
      const startDateTime = new Date(startDate)
      startDateTime.setHours(0, 0, 0, 0)
      const endDateTime = new Date(endDate)
      endDateTime.setHours(23, 59, 59, 999)

      query = query
        .gte('sold_at', startDateTime.toISOString())
        .lte('sold_at', endDateTime.toISOString())

      if (paymentMethod) {
        query = query.eq('payment_method', paymentMethod)
      }

      // 특정 매장이 선택된 경우에만 store_id 추가
      if (storeId) {
        query = query.eq('store_id', storeId)
      }

      const { data, error } = await query

      if (error) throw error

      setSales(data || [])

      // 통계 계산
      const stats = data?.reduce((acc, sale) => ({
        count: acc.count + 1,
        amount: acc.amount + (sale.canceled_at ? 0 : sale.final_amount),
        canceled: acc.canceled + (sale.canceled_at ? 1 : 0)
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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('sales_transactions')
        .update({
          payment_status: 'canceled',
          canceled_at: new Date().toISOString(),
          canceled_by: user.id,
          canceled_reason: reason
        })
        .eq('id', saleId)

      if (error) throw error

      alert('판매가 취소되었습니다.')
      fetchSales()
    } catch (error) {
      console.error('Error canceling sale:', error)
      alert('취소 중 오류가 발생했습니다.')
    }
  }

  const canCancelSale = ['super_admin', 'admin', 'manager'].includes(userRole)

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

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bagel-yellow mx-auto"></div>
          <p className="mt-4 text-black">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-black">판매 내역</h1>
        <p className="text-black mt-2">
          {storeName ? `${storeName} - ` : ''}판매 기록을 조회하고 관리합니다.
        </p>
      </div>

      {/* 매장 선택 (관리자만) */}
      {(userRole === 'super_admin' || userRole === 'admin') && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center gap-4">
            <Building2 className="h-5 w-5 text-black" />
            <span className="text-sm font-medium text-black">매장 선택:</span>
            <div className="flex-1 max-w-md">
              <StoreSelector
                selectedStoreId={storeId}
                onStoreChange={(newStoreId, newStoreName) => {
                  setStoreId(newStoreId || null)
                  setStoreName(newStoreName)
                }}
                userRole={userRole}
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
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
          <h3 className="text-sm font-medium text-gray-700">총 판매 건수</h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {totalStats.count.toLocaleString()}건
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-700">총 매출액</h3>
          <p className="text-2xl font-bold text-bagel-yellow mt-2">
            ₩{totalStats.amount.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-700">취소 건수</h3>
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
              {sales.map((sale) => (
                <React.Fragment key={sale.id}>
                  <tr className={sale.canceled_at ? 'bg-gray-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(sale.sold_at), 'yyyy-MM-dd HH:mm', { locale: ko })}
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
                      <span className={sale.canceled_at ? 'line-through text-gray-600' : 'text-gray-900'}>
                        ₩{sale.final_amount.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {sale.canceled_at ? (
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
                        {canCancelSale && !sale.canceled_at && (
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
                              <span className="text-gray-900">{sale.profiles?.full_name || '알 수 없음'}</span>
                            </div>
                            {sale.customer_name && (
                              <div>
                                <span className="font-medium text-gray-700">고객명:</span>{' '}
                                <span className="text-gray-900">{sale.customer_name}</span>
                              </div>
                            )}
                            {sale.canceled_at && (
                              <div>
                                <span className="font-medium text-gray-700">취소일시:</span>{' '}
                                <span className="text-gray-900">
                                  {format(new Date(sale.canceled_at), 'yyyy-MM-dd HH:mm', { locale: ko })}
                                </span>
                              </div>
                            )}
                            {sale.canceled_reason && (
                              <div>
                                <span className="font-medium text-gray-700">취소사유:</span>{' '}
                                <span className="text-gray-900">{sale.canceled_reason}</span>
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
                                          {item.product?.name || '알 수 없는 상품'}
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
            <p className="text-gray-700">조회 결과가 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  )
}