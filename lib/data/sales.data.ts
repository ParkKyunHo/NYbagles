/**
 * Sales Data Layer
 * 서버 컴포넌트에서 사용할 판매 데이터 페칭 함수
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient, createSafeAdminClient } from '@/lib/supabase/server-admin'
import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, isValid } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'

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

/**
 * 시간별 매출 데이터 인터페이스
 */
export interface HourlySalesData {
  hour: number
  hourLabel: string // e.g., "09:00", "14:00"
  currentSales: number
  previousWeekSales: number
  currentTransactionCount: number
  previousTransactionCount: number
  difference: number
  percentageChange: number
  isCurrentHour: boolean // 현재 시간인지 표시
  hasData: boolean // 데이터가 있는지 여부
}

/**
 * 시간별 매출 상세 데이터
 */
export interface HourlySalesDetail {
  hour: number
  sales: number
  transactionCount: number
  averageTransaction: number
  timestamp: string // ISO timestamp for the hour
}

/**
 * 시간별 매출 비교 데이터 조회 (한국 시간대 적용)
 * @param storeId - 매장 ID (null이면 모든 매장)
 * @param date - 조회할 날짜 (YYYY-MM-DD 형식)
 * @returns 시간별 매출 비교 데이터 배열
 */
export const getHourlySalesComparison = unstable_cache(
  async (storeId: string | null, date: string): Promise<HourlySalesData[]> => {
    const adminClient = createSafeAdminClient()
    const TIMEZONE = 'Asia/Seoul'
    
    try {
      // 날짜 유효성 검증
      const parsedDate = parseISO(date)
      if (!isValid(parsedDate)) {
        throw new Error(`Invalid date format: ${date}. Expected YYYY-MM-DD`)
      }
      
      // 한국 시간대로 변환
      const currentDateKST = toZonedTime(parsedDate, TIMEZONE)
      const previousWeekDateKST = subDays(currentDateKST, 7)
      
      // UTC 시간으로 변환 (데이터베이스 쿼리용)
      const currentStartUTC = fromZonedTime(
        new Date(currentDateKST.getFullYear(), currentDateKST.getMonth(), currentDateKST.getDate(), 0, 0, 0),
        TIMEZONE
      )
      const currentEndUTC = fromZonedTime(
        new Date(currentDateKST.getFullYear(), currentDateKST.getMonth(), currentDateKST.getDate(), 23, 59, 59, 999),
        TIMEZONE
      )
      
      const previousStartUTC = fromZonedTime(
        new Date(previousWeekDateKST.getFullYear(), previousWeekDateKST.getMonth(), previousWeekDateKST.getDate(), 0, 0, 0),
        TIMEZONE
      )
      const previousEndUTC = fromZonedTime(
        new Date(previousWeekDateKST.getFullYear(), previousWeekDateKST.getMonth(), previousWeekDateKST.getDate(), 23, 59, 59, 999),
        TIMEZONE
      )
      
      // 현재 날짜 시간별 매출 쿼리
      const currentQuery = adminClient
        .from('sales_transactions')
        .select('sold_at, total_amount, id')
        .gte('sold_at', currentStartUTC.toISOString())
        .lte('sold_at', currentEndUTC.toISOString())
        .eq('payment_status', 'completed')
      
      // 이전 주 시간별 매출 쿼리
      const previousQuery = adminClient
        .from('sales_transactions')
        .select('sold_at, total_amount, id')
        .gte('sold_at', previousStartUTC.toISOString())
        .lte('sold_at', previousEndUTC.toISOString())
        .eq('payment_status', 'completed')
      
      // 매장 필터 적용
      if (storeId) {
        currentQuery.eq('store_id', storeId)
        previousQuery.eq('store_id', storeId)
      }
      
      // 병렬로 데이터 가져오기
      const [currentData, previousData] = await Promise.all([
        currentQuery,
        previousQuery
      ])
      
      // 에러 처리
      if (!currentData.data || !previousData.data) {
        console.error('Failed to fetch hourly sales data')
        return []
      }
      
      // 시간별로 데이터 집계
      interface HourlyMetrics {
        currentSales: number
        previousSales: number
        currentCount: number
        previousCount: number
      }
      
      const hourlyMap = new Map<number, HourlyMetrics>()
      
      // 0-23시까지 초기화
      for (let hour = 0; hour < 24; hour++) {
        hourlyMap.set(hour, {
          currentSales: 0,
          previousSales: 0,
          currentCount: 0,
          previousCount: 0
        })
      }
      
      // 현재 날짜 데이터 집계 (KST 기준)
      currentData.data.forEach(transaction => {
        if (transaction.sold_at) {
          const kstTime = toZonedTime(new Date(transaction.sold_at), TIMEZONE)
          const hour = kstTime.getHours()
          const metrics = hourlyMap.get(hour)!
          metrics.currentSales += Number(transaction.total_amount)
          metrics.currentCount += 1
        }
      })
      
      // 이전 주 데이터 집계 (KST 기준)
      previousData.data.forEach(transaction => {
        if (transaction.sold_at) {
          const kstTime = toZonedTime(new Date(transaction.sold_at), TIMEZONE)
          const hour = kstTime.getHours()
          const metrics = hourlyMap.get(hour)!
          metrics.previousSales += Number(transaction.total_amount)
          metrics.previousCount += 1
        }
      })
      
      // 현재 시간 계산 (KST)
      const nowKST = toZonedTime(new Date(), TIMEZONE)
      const currentHourKST = nowKST.getHours()
      const isToday = format(currentDateKST, 'yyyy-MM-dd') === format(nowKST, 'yyyy-MM-dd')
      
      // 결과 배열 생성
      const result: HourlySalesData[] = []
      
      // 오늘이면 현재 시간까지만, 과거 날짜면 24시간 전체
      const maxHour = isToday ? currentHourKST : 23
      
      for (let hour = 0; hour <= maxHour; hour++) {
        const metrics = hourlyMap.get(hour)!
        const difference = metrics.currentSales - metrics.previousSales
        
        // 퍼센트 변화 계산 (0으로 나누기 방지)
        let percentageChange = 0
        if (metrics.previousSales > 0) {
          percentageChange = (difference / metrics.previousSales) * 100
        } else if (metrics.currentSales > 0) {
          // 이전 매출이 0이고 현재 매출이 있으면 100% 증가
          percentageChange = 100
        }
        
        result.push({
          hour,
          hourLabel: `${hour.toString().padStart(2, '0')}:00`,
          currentSales: Math.round(metrics.currentSales * 100) / 100, // 소수점 2자리
          previousWeekSales: Math.round(metrics.previousSales * 100) / 100,
          currentTransactionCount: metrics.currentCount,
          previousTransactionCount: metrics.previousCount,
          difference: Math.round(difference * 100) / 100,
          percentageChange: Math.round(percentageChange * 10) / 10, // 소수점 1자리
          isCurrentHour: isToday && hour === currentHourKST,
          hasData: metrics.currentSales > 0 || metrics.previousSales > 0
        })
      }
      
      return result
      
    } catch (error) {
      console.error('Error in getHourlySalesComparison:', error)
      // 에러 발생 시 빈 배열 반환
      return []
    }
  },
  ['hourly-sales-comparison'],
  {
    revalidate: 300, // 5분 캐싱
    tags: ['sales', 'hourly-sales']
  }
)

/**
 * 특정 시간대의 상세 매출 정보 조회
 * @param storeId - 매장 ID
 * @param date - 조회할 날짜 (YYYY-MM-DD 형식)
 * @param hour - 조회할 시간 (0-23)
 * @returns 해당 시간대의 상세 매출 정보
 */
export const getHourlySalesDetail = unstable_cache(
  async (storeId: string | null, date: string, hour: number): Promise<HourlySalesDetail | null> => {
    const adminClient = createSafeAdminClient()
    const TIMEZONE = 'Asia/Seoul'
    
    try {
      // 입력 검증
      if (hour < 0 || hour > 23) {
        throw new Error(`Invalid hour: ${hour}. Must be between 0 and 23`)
      }
      
      const parsedDate = parseISO(date)
      if (!isValid(parsedDate)) {
        throw new Error(`Invalid date format: ${date}. Expected YYYY-MM-DD`)
      }
      
      // 한국 시간대로 변환
      const dateKST = toZonedTime(parsedDate, TIMEZONE)
      
      // 해당 시간의 시작과 끝 (UTC)
      const hourStartKST = new Date(dateKST.getFullYear(), dateKST.getMonth(), dateKST.getDate(), hour, 0, 0)
      const hourEndKST = new Date(dateKST.getFullYear(), dateKST.getMonth(), dateKST.getDate(), hour, 59, 59, 999)
      
      const hourStartUTC = fromZonedTime(hourStartKST, TIMEZONE)
      const hourEndUTC = fromZonedTime(hourEndKST, TIMEZONE)
      
      // 쿼리 생성
      let query = adminClient
        .from('sales_transactions')
        .select('total_amount, id')
        .gte('sold_at', hourStartUTC.toISOString())
        .lte('sold_at', hourEndUTC.toISOString())
        .eq('payment_status', 'completed')
      
      if (storeId) {
        query = query.eq('store_id', storeId)
      }
      
      const { data, error } = await query
      
      if (error) {
        console.error('Error fetching hourly sales detail:', error)
        return null
      }
      
      if (!data || data.length === 0) {
        return {
          hour,
          sales: 0,
          transactionCount: 0,
          averageTransaction: 0,
          timestamp: hourStartKST.toISOString()
        }
      }
      
      // 집계
      const totalSales = data.reduce((sum, t) => sum + Number(t.total_amount), 0)
      const transactionCount = data.length
      const averageTransaction = transactionCount > 0 ? totalSales / transactionCount : 0
      
      return {
        hour,
        sales: Math.round(totalSales * 100) / 100,
        transactionCount,
        averageTransaction: Math.round(averageTransaction * 100) / 100,
        timestamp: hourStartKST.toISOString()
      }
      
    } catch (error) {
      console.error('Error in getHourlySalesDetail:', error)
      return null
    }
  },
  ['hourly-sales-detail'],
  {
    revalidate: 300, // 5분 캐싱
    tags: ['sales', 'hourly-sales']
  }
)

/**
 * 시간별 매출 트렌드 데이터 조회 (최근 7일)
 * @param storeId - 매장 ID
 * @param hour - 조회할 시간 (0-23)
 * @returns 최근 7일간 해당 시간대의 매출 트렌드
 */
export const getHourlyTrend = unstable_cache(
  async (storeId: string | null, hour: number): Promise<Array<{
    date: string
    sales: number
    transactionCount: number
  }>> => {
    const adminClient = createSafeAdminClient()
    const TIMEZONE = 'Asia/Seoul'
    
    try {
      // 입력 검증
      if (hour < 0 || hour > 23) {
        throw new Error(`Invalid hour: ${hour}. Must be between 0 and 23`)
      }
      
      const results = []
      const today = new Date()
      
      // 최근 7일간 데이터 수집
      for (let i = 6; i >= 0; i--) {
        const targetDate = subDays(today, i)
        const dateStr = format(targetDate, 'yyyy-MM-dd')
        
        const detail = await getHourlySalesDetail(storeId, dateStr, hour)
        
        if (detail) {
          results.push({
            date: dateStr,
            sales: detail.sales,
            transactionCount: detail.transactionCount
          })
        } else {
          results.push({
            date: dateStr,
            sales: 0,
            transactionCount: 0
          })
        }
      }
      
      return results
      
    } catch (error) {
      console.error('Error in getHourlyTrend:', error)
      return []
    }
  },
  ['hourly-trend'],
  {
    revalidate: 600, // 10분 캐싱 (트렌드 데이터는 덜 자주 변경됨)
    tags: ['sales', 'hourly-sales', 'trends']
  }
)

/**
 * 시간별 매출 분석 데이터
 */
export interface HourlySalesAnalysis {
  bestHours: Array<{
    hour: number
    hourLabel: string
    averageSales: number
    frequency: number // 해당 시간에 매출이 발생한 날짜 수
  }>
  worstHours: Array<{
    hour: number
    hourLabel: string
    averageSales: number
    frequency: number
  }>
  peakHour: number
  quietHour: number
  averageHourlySales: number
}

/**
 * 시간별 매출 분석 (최근 30일 기준)
 * @param storeId - 매장 ID
 * @returns 시간별 매출 분석 데이터
 */
export const getHourlySalesAnalysis = unstable_cache(
  async (storeId: string | null): Promise<HourlySalesAnalysis | null> => {
    const adminClient = createSafeAdminClient()
    const TIMEZONE = 'Asia/Seoul'
    
    try {
      const endDate = new Date()
      const startDate = subDays(endDate, 30)
      
      // UTC 시간으로 변환
      const startUTC = fromZonedTime(
        new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0),
        TIMEZONE
      )
      const endUTC = fromZonedTime(
        new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999),
        TIMEZONE
      )
      
      // 최근 30일 매출 데이터 조회
      let query = adminClient
        .from('sales_transactions')
        .select('sold_at, total_amount')
        .gte('sold_at', startUTC.toISOString())
        .lte('sold_at', endUTC.toISOString())
        .eq('payment_status', 'completed')
      
      if (storeId) {
        query = query.eq('store_id', storeId)
      }
      
      const { data, error } = await query
      
      if (error || !data) {
        console.error('Error fetching sales analysis:', error)
        return null
      }
      
      // 시간별 집계
      const hourlyStats = new Map<number, { totalSales: number; days: Set<string> }>()
      
      // 초기화
      for (let hour = 0; hour < 24; hour++) {
        hourlyStats.set(hour, { totalSales: 0, days: new Set() })
      }
      
      // 데이터 집계
      data.forEach(transaction => {
        if (transaction.sold_at) {
          const kstTime = toZonedTime(new Date(transaction.sold_at), TIMEZONE)
          const hour = kstTime.getHours()
          const dateStr = format(kstTime, 'yyyy-MM-dd')
          
          const stats = hourlyStats.get(hour)!
          stats.totalSales += Number(transaction.total_amount)
          stats.days.add(dateStr)
        }
      })
      
      // 평균 계산 및 정렬
      const hourlyAverages = Array.from(hourlyStats.entries()).map(([hour, stats]) => ({
        hour,
        hourLabel: `${hour.toString().padStart(2, '0')}:00`,
        averageSales: stats.days.size > 0 ? stats.totalSales / stats.days.size : 0,
        frequency: stats.days.size
      }))
      
      // 매출 기준 정렬
      const sortedByRevenue = [...hourlyAverages].sort((a, b) => b.averageSales - a.averageSales)
      
      // 전체 평균
      const totalAverage = hourlyAverages.reduce((sum, h) => sum + h.averageSales, 0) / 24
      
      return {
        bestHours: sortedByRevenue.slice(0, 5),
        worstHours: sortedByRevenue.slice(-5).reverse(),
        peakHour: sortedByRevenue[0]?.hour || 0,
        quietHour: sortedByRevenue[sortedByRevenue.length - 1]?.hour || 0,
        averageHourlySales: Math.round(totalAverage * 100) / 100
      }
      
    } catch (error) {
      console.error('Error in getHourlySalesAnalysis:', error)
      return null
    }
  },
  ['hourly-sales-analysis'],
  {
    revalidate: 3600, // 1시간 캐싱 (분석 데이터는 자주 변경되지 않음)
    tags: ['sales', 'hourly-sales', 'analysis']
  }
)

/**
 * 매출 데이터 캐시 무효화
 * 새로운 매출이 발생했을 때 관련 캐시를 무효화
 */
export async function invalidateSalesCache() {
  const { revalidateTag } = await import('next/cache')
  
  // 매출 관련 모든 캐시 태그 무효화
  revalidateTag('sales')
  revalidateTag('hourly-sales')
  revalidateTag('sales-history')
  revalidateTag('trends')
  revalidateTag('analysis')
}

/**
 * 특정 날짜의 매출 캐시만 무효화
 * @param date - 무효화할 날짜
 */
export async function invalidateSalesCacheForDate(date: string) {
  const { revalidateTag } = await import('next/cache')
  
  // 특정 날짜와 관련된 캐시 태그 무효화
  revalidateTag('sales')
  revalidateTag('hourly-sales')
  // 날짜별 캐시 태그가 있다면 추가
}

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