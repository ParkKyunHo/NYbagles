#!/usr/bin/env tsx
/**
 * Test script for hourly sales comparison functionality
 * Usage: tsx scripts/test-hourly-sales.ts
 */

import { getHourlySalesComparison, getHourlySalesDetail, getHourlyTrend } from '@/lib/data/sales.data'
import { format } from 'date-fns'

async function testHourlySales() {
  console.log('🧪 Testing Hourly Sales Comparison Functions...\n')
  
  const testStoreId = null // Test with all stores
  const testDate = format(new Date(), 'yyyy-MM-dd') // Today
  
  try {
    // Test 1: Get hourly sales comparison
    console.log('📊 Test 1: Hourly Sales Comparison')
    console.log(`Date: ${testDate}`)
    console.log(`Store: ${testStoreId || 'All stores'}\n`)
    
    const hourlySales = await getHourlySalesComparison(testStoreId, testDate)
    
    if (hourlySales.length === 0) {
      console.log('⚠️  No hourly sales data found')
    } else {
      console.log(`Found data for ${hourlySales.length} hours\n`)
      
      // Display first 5 hours
      console.log('Sample data (first 5 hours):')
      console.log('─'.repeat(80))
      console.log('Hour | Current Sales | Previous Week | Difference | Change %')
      console.log('─'.repeat(80))
      
      hourlySales.slice(0, 5).forEach(hour => {
        const changeIndicator = hour.difference > 0 ? '↑' : hour.difference < 0 ? '↓' : '='
        const currentFlag = hour.isCurrentHour ? ' ← Current' : ''
        
        console.log(
          `${hour.hourLabel} | ` +
          `₩${hour.currentSales.toLocaleString().padStart(12)} | ` +
          `₩${hour.previousWeekSales.toLocaleString().padStart(12)} | ` +
          `₩${hour.difference.toLocaleString().padStart(10)} | ` +
          `${changeIndicator} ${hour.percentageChange.toFixed(1)}%` +
          currentFlag
        )
      })
      console.log('─'.repeat(80))
      
      // Summary statistics
      const totalCurrent = hourlySales.reduce((sum, h) => sum + h.currentSales, 0)
      const totalPrevious = hourlySales.reduce((sum, h) => sum + h.previousWeekSales, 0)
      const totalDifference = totalCurrent - totalPrevious
      const totalChangePercent = totalPrevious > 0 ? (totalDifference / totalPrevious) * 100 : 0
      
      console.log('\n📈 Summary:')
      console.log(`Total Current Sales: ₩${totalCurrent.toLocaleString()}`)
      console.log(`Total Previous Week: ₩${totalPrevious.toLocaleString()}`)
      console.log(`Total Difference: ₩${totalDifference.toLocaleString()}`)
      console.log(`Overall Change: ${totalChangePercent.toFixed(1)}%`)
    }
    
    // Test 2: Get specific hour detail
    console.log('\n\n📊 Test 2: Specific Hour Detail (12:00 PM)')
    const hourDetail = await getHourlySalesDetail(testStoreId, testDate, 12)
    
    if (hourDetail) {
      console.log(`Hour: ${hourDetail.hour}:00`)
      console.log(`Sales: ₩${hourDetail.sales.toLocaleString()}`)
      console.log(`Transactions: ${hourDetail.transactionCount}`)
      console.log(`Average Transaction: ₩${hourDetail.averageTransaction.toLocaleString()}`)
    } else {
      console.log('⚠️  No data for this hour')
    }
    
    // Test 3: Get hourly trend
    console.log('\n\n📊 Test 3: 7-Day Trend for 12:00 PM')
    const trend = await getHourlyTrend(testStoreId, 12)
    
    if (trend.length > 0) {
      console.log('─'.repeat(50))
      console.log('Date       | Sales          | Transactions')
      console.log('─'.repeat(50))
      
      trend.forEach(day => {
        console.log(
          `${day.date} | ₩${day.sales.toLocaleString().padStart(12)} | ${day.transactionCount.toString().padStart(12)}`
        )
      })
      console.log('─'.repeat(50))
    } else {
      console.log('⚠️  No trend data found')
    }
    
    console.log('\n✅ All tests completed successfully!')
    
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