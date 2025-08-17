#!/usr/bin/env tsx
/**
 * Direct test script for hourly sales comparison functionality
 * Usage: tsx scripts/test-hourly-sales-direct.ts
 */

import { createClient } from '@supabase/supabase-js'
import { format, subDays, parseISO, isValid } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import * as dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface HourlySalesData {
  hour: number
  hourLabel: string
  currentSales: number
  previousWeekSales: number
  currentTransactionCount: number
  previousTransactionCount: number
  difference: number
  percentageChange: number
  isCurrentHour: boolean
  hasData: boolean
}

async function getHourlySalesComparisonDirect(
  storeId: string | null,
  date: string
): Promise<HourlySalesData[]> {
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

    console.log('📅 Date ranges:')
    console.log(`  Current: ${currentStartUTC.toISOString()} to ${currentEndUTC.toISOString()}`)
    console.log(`  Previous: ${previousStartUTC.toISOString()} to ${previousEndUTC.toISOString()}`)

    // 현재 날짜 시간별 매출 쿼리
    const currentQuery = supabase
      .from('sales_transactions')
      .select('sold_at, total_amount, id')
      .gte('sold_at', currentStartUTC.toISOString())
      .lte('sold_at', currentEndUTC.toISOString())
      .eq('payment_status', 'completed')

    // 이전 주 시간별 매출 쿼리
    const previousQuery = supabase
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

    console.log(`\n📊 Data fetched:`)
    console.log(`  Current week: ${currentData.data?.length || 0} transactions`)
    console.log(`  Previous week: ${previousData.data?.length || 0} transactions`)

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
        currentSales: Math.round(metrics.currentSales * 100) / 100,
        previousWeekSales: Math.round(metrics.previousSales * 100) / 100,
        currentTransactionCount: metrics.currentCount,
        previousTransactionCount: metrics.previousCount,
        difference: Math.round(difference * 100) / 100,
        percentageChange: Math.round(percentageChange * 10) / 10,
        isCurrentHour: isToday && hour === currentHourKST,
        hasData: metrics.currentSales > 0 || metrics.previousSales > 0
      })
    }

    return result

  } catch (error) {
    console.error('Error in getHourlySalesComparison:', error)
    return []
  }
}

async function testHourlySales() {
  console.log('🧪 Testing Hourly Sales Comparison Functions...\n')

  const testStoreId = null // Test with all stores
  const testDate = format(new Date(), 'yyyy-MM-dd') // Today

  try {
    // Test hourly sales comparison
    console.log('📊 Hourly Sales Comparison Test')
    console.log(`Date: ${testDate}`)
    console.log(`Store: ${testStoreId || 'All stores'}\n`)

    const hourlySales = await getHourlySalesComparisonDirect(testStoreId, testDate)

    if (hourlySales.length === 0) {
      console.log('⚠️  No hourly sales data found')
    } else {
      console.log(`\n✅ Found data for ${hourlySales.length} hours\n`)

      // Display all hours with data
      console.log('Hourly Sales Data:')
      console.log('═'.repeat(100))
      console.log('Hour  | Current Sales | Transactions | Previous Week | Transactions | Difference | Change %')
      console.log('─'.repeat(100))

      let hasAnyData = false
      hourlySales.forEach(hour => {
        if (hour.hasData || hour.isCurrentHour) {
          hasAnyData = true
          const changeIndicator = hour.difference > 0 ? '↑' : hour.difference < 0 ? '↓' : '='
          const currentFlag = hour.isCurrentHour ? ' ← Now' : ''

          console.log(
            `${hour.hourLabel} | ` +
            `₩${hour.currentSales.toLocaleString().padStart(12)} | ` +
            `${hour.currentTransactionCount.toString().padStart(12)} | ` +
            `₩${hour.previousWeekSales.toLocaleString().padStart(12)} | ` +
            `${hour.previousTransactionCount.toString().padStart(12)} | ` +
            `₩${hour.difference.toLocaleString().padStart(10)} | ` +
            `${changeIndicator} ${hour.percentageChange.toFixed(1).padStart(6)}%` +
            currentFlag
          )
        }
      })

      if (!hasAnyData) {
        console.log('(No sales data for any hour)')
      }

      console.log('═'.repeat(100))

      // Summary statistics
      const totalCurrent = hourlySales.reduce((sum, h) => sum + h.currentSales, 0)
      const totalPrevious = hourlySales.reduce((sum, h) => sum + h.previousWeekSales, 0)
      const totalCurrentCount = hourlySales.reduce((sum, h) => sum + h.currentTransactionCount, 0)
      const totalPreviousCount = hourlySales.reduce((sum, h) => sum + h.previousTransactionCount, 0)
      const totalDifference = totalCurrent - totalPrevious
      const totalChangePercent = totalPrevious > 0 ? (totalDifference / totalPrevious) * 100 : 0

      console.log('\n📈 Daily Summary:')
      console.log('─'.repeat(50))
      console.log(`Total Current Sales: ₩${totalCurrent.toLocaleString()} (${totalCurrentCount} transactions)`)
      console.log(`Total Previous Week: ₩${totalPrevious.toLocaleString()} (${totalPreviousCount} transactions)`)
      console.log(`Total Difference: ₩${totalDifference.toLocaleString()}`)
      console.log(`Overall Change: ${totalChangePercent > 0 ? '↑' : totalChangePercent < 0 ? '↓' : '='} ${totalChangePercent.toFixed(1)}%`)
      console.log('─'.repeat(50))

      // Peak hours analysis
      const peakCurrentHour = hourlySales.reduce((max, h) => 
        h.currentSales > max.currentSales ? h : max
      )
      const peakPreviousHour = hourlySales.reduce((max, h) => 
        h.previousWeekSales > max.previousWeekSales ? h : max
      )

      console.log('\n⏰ Peak Hours:')
      console.log(`Current Week Peak: ${peakCurrentHour.hourLabel} (₩${peakCurrentHour.currentSales.toLocaleString()})`)
      console.log(`Previous Week Peak: ${peakPreviousHour.hourLabel} (₩${peakPreviousHour.previousWeekSales.toLocaleString()})`)
    }

    console.log('\n✅ Test completed successfully!')

  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

// Run tests
testHourlySales()
  .then(() => {
    console.log('\n🎉 Test script finished')
    process.exit(0)
  })
  .catch(error => {
    console.error('💥 Unexpected error:', error)
    process.exit(1)
  })