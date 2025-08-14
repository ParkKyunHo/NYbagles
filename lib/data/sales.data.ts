/**
 * Sales Data Layer
 * 서버 컴포넌트에서 사용할 판매 데이터 페칭 함수
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient, createSafeAdminClient } from '@/lib/supabase/server-admin'
import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'

export interface SalesSummaryData {
  totalSales: number
  transactionCount: number
  averageTransaction: number
  topProducts: Array<{
    id: string
    name: string
    quantity: number
    revenue: number
  }>
  dailySales: Array<{
    date: string
    total: number
    count: number
  }>
  paymentMethods: {
    cash: number
    card: number
    mobile: number
  }
}

/**
 * 매출 요약 데이터 조회 (캐싱 적용)
 * 5분 캐싱으로 성능 최적화
 */
export const getSalesSummary = unstable_cache(
  async (storeId: string | null, startDate: string, endDate: string): Promise<SalesSummaryData> => {
    const adminClient = createSafeAdminClient()
    
    // 병렬 데이터 페칭으로 성능 최적화
    const [salesData, topProducts, dailySales, paymentData] = await Promise.all([
      // 1. 총 매출 및 거래 수
      adminClient
        .from('sales_transactions')
        .select('total_amount')
        .gte('sold_at', startDate)
        .lte('sold_at', endDate)
        .eq('payment_status', 'completed')
        .match(storeId ? { store_id: storeId } : {}),
      
      // 2. 인기 상품 TOP 5
      adminClient
        .from('sales_items')
        .select(`
          product_id,
          quantity,
          subtotal,
          products!inner(
            id,
            name
          )
        `)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .match(storeId ? { 'products.store_id': storeId } : {}),
      
      // 3. 일별 매출
      adminClient.rpc('get_daily_sales', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_store_id: storeId
      }),
      
      // 4. 결제 방법별 매출
      adminClient
        .from('sales_transactions')
        .select('payment_method, total_amount')
        .gte('sold_at', startDate)
        .lte('sold_at', endDate)
        .eq('payment_status', 'completed')
        .match(storeId ? { store_id: storeId } : {})
    ])
    
    // 데이터 집계 및 변환
    const totalSales = salesData.data?.reduce((sum, s) => sum + Number(s.total_amount), 0) || 0
    const transactionCount = salesData.data?.length || 0
    const averageTransaction = transactionCount > 0 ? totalSales / transactionCount : 0
    
    // 상품별 집계
    const productMap = new Map<string, { name: string; quantity: number; revenue: number }>()
    topProducts.data?.forEach(item => {
      const product = item.products as any
      if (!productMap.has(product.id)) {
        productMap.set(product.id, {
          name: product.name,
          quantity: 0,
          revenue: 0
        })
      }
      const current = productMap.get(product.id)!
      current.quantity += item.quantity
      current.revenue += Number(item.subtotal)
    })
    
    const topProductsList = Array.from(productMap.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
    
    // 결제 방법별 집계
    const paymentMethods = {
      cash: 0,
      card: 0,
      mobile: 0
    }
    
    paymentData.data?.forEach(transaction => {
      const method = transaction.payment_method as keyof typeof paymentMethods
      if (method in paymentMethods) {
        paymentMethods[method] += Number(transaction.total_amount)
      }
    })
    
    return {
      totalSales,
      transactionCount,
      averageTransaction,
      topProducts: topProductsList,
      dailySales: dailySales.data || [],
      paymentMethods
    }
  },
  ['sales-summary'],
  {
    revalidate: 300, // 5분 캐싱
    tags: ['sales']
  }
)

/**
 * 실시간 매출 데이터 (캐싱 없음)
 */
export const getRealtimeSales = cache(async (storeId: string) => {
  const adminClient = createSafeAdminClient()
  const today = format(new Date(), 'yyyy-MM-dd')
  
  const { data, error } = await adminClient
    .from('sales_transactions')
    .select('*')
    .eq('store_id', storeId)
    .gte('sold_at', today)
    .order('sold_at', { ascending: false })
    .limit(10)
  
  if (error) throw error
  return data
})

/**
 * 기간별 매출 비교
 */
export const compareSalesPeriods = unstable_cache(
  async (storeId: string | null, currentStart: string, currentEnd: string) => {
    const adminClient = createSafeAdminClient()
    
    // 이전 기간 계산
    const daysDiff = Math.ceil(
      (new Date(currentEnd).getTime() - new Date(currentStart).getTime()) / (1000 * 60 * 60 * 24)
    )
    const previousStart = format(subDays(new Date(currentStart), daysDiff), 'yyyy-MM-dd')
    const previousEnd = format(subDays(new Date(currentEnd), daysDiff), 'yyyy-MM-dd')
    
    const [current, previous] = await Promise.all([
      getSalesSummary(storeId, currentStart, currentEnd),
      getSalesSummary(storeId, previousStart, previousEnd)
    ])
    
    return {
      current,
      previous,
      growth: {
        sales: previous.totalSales > 0 
          ? ((current.totalSales - previous.totalSales) / previous.totalSales) * 100 
          : 0,
        transactions: previous.transactionCount > 0
          ? ((current.transactionCount - previous.transactionCount) / previous.transactionCount) * 100
          : 0
      }
    }
  },
  ['sales-comparison'],
  {
    revalidate: 300,
    tags: ['sales']
  }
)

export interface SaleTransaction {
  id: string
  transaction_number: string
  store_id: string
  transaction_type: string
  subtotal: number
  tax_amount?: number
  discount_amount?: number
  total_amount: number
  payment_method: string
  payment_status: string
  sold_by: string
  sold_at?: string
  parent_transaction_id?: string
  sales_items?: Array<{
    id: string
    product_id: string
    quantity: number
    unit_price: number
    subtotal: number
    products?: {
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
  } | null
}

export interface SalesHistoryFilters {
  storeId?: string | null
  startDate: string
  endDate: string
  paymentMethod?: string
  status?: string
  limit?: number
}

/**
 * 판매 내역 조회 (캐싱 적용)
 */
export const getSalesHistory = unstable_cache(
  async (filters: SalesHistoryFilters): Promise<{
    transactions: SaleTransaction[]
    stats: {
      count: number
      totalAmount: number
      cancelledCount: number
    }
  }> => {
    const adminClient = createSafeAdminClient()
    
    // 시간 설정
    const startDateTime = new Date(filters.startDate)
    startDateTime.setHours(0, 0, 0, 0)
    const endDateTime = new Date(filters.endDate)
    endDateTime.setHours(23, 59, 59, 999)
    
    // 쿼리 빌드 - sold_by를 통한 profiles 조인
    let query = adminClient
      .from('sales_transactions')
      .select(`
        *,
        sales_items (
          *,
          products (
            id,
            name
          )
        ),
        stores (
          id,
          name
        )
      `)
      .gte('sold_at', startDateTime.toISOString())
      .lte('sold_at', endDateTime.toISOString())
      .order('sold_at', { ascending: false })
      .limit(filters.limit || 100)
    
    // 필터 적용
    if (filters.storeId) {
      query = query.eq('store_id', filters.storeId)
    }
    
    if (filters.paymentMethod) {
      query = query.eq('payment_method', filters.paymentMethod)
    }
    
    if (filters.status) {
      query = query.eq('payment_status', filters.status)
    }
    
    const { data, error } = await query
    
    if (error) throw error
    
    // sold_by ID들을 수집하여 profiles 정보 가져오기
    const sellerIds = [...new Set((data || []).map(t => t.sold_by).filter(Boolean))]
    
    let profilesMap = new Map<string, { full_name: string }>()
    
    if (sellerIds.length > 0) {
      const { data: profilesData } = await adminClient
        .from('profiles')
        .select('id, full_name')
        .in('id', sellerIds)
      
      if (profilesData) {
        profilesData.forEach(profile => {
          profilesMap.set(profile.id, { full_name: profile.full_name })
        })
      }
    }
    
    // 데이터에 profiles 정보 추가 및 타입 캐스팅
    const enrichedData: SaleTransaction[] = (data || []).map(transaction => ({
      id: transaction.id,
      transaction_number: transaction.transaction_number,
      store_id: transaction.store_id,
      transaction_type: transaction.transaction_type,
      subtotal: Number(transaction.subtotal),
      tax_amount: transaction.tax_amount ? Number(transaction.tax_amount) : undefined,
      discount_amount: transaction.discount_amount ? Number(transaction.discount_amount) : undefined,
      total_amount: Number(transaction.total_amount),
      payment_method: transaction.payment_method,
      payment_status: transaction.payment_status,
      sold_by: transaction.sold_by,
      sold_at: transaction.sold_at,
      parent_transaction_id: transaction.parent_transaction_id,
      sales_items: transaction.sales_items,
      stores: transaction.stores,
      profiles: profilesMap.get(transaction.sold_by) || null
    }))
    
    // 통계 계산
    const stats = enrichedData.reduce((acc, sale) => ({
      count: acc.count + 1,
      totalAmount: acc.totalAmount + (sale.payment_status === 'cancelled' ? 0 : Number(sale.total_amount)),
      cancelledCount: acc.cancelledCount + (sale.payment_status === 'cancelled' ? 1 : 0)
    }), { count: 0, totalAmount: 0, cancelledCount: 0 })
    
    return {
      transactions: enrichedData,
      stats
    }
  },
  ['sales-history'],
  {
    revalidate: 60, // 1분 캐싱 (더 자주 업데이트)
    tags: ['sales', 'sales-history']
  }
)