import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/stores/[id]/sales - Get store sales data
 * Admin-only endpoint for QR sales scanning
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const storeId = params.id
    
    // Authentication check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: '사용자 정보를 찾을 수 없습니다.' }, { status: 404 })
    }

    // Only admins and super_admins can access store sales data
    if (!['admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    // Validate store ID format (UUID)
    if (!storeId || !storeId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return NextResponse.json({ error: '유효하지 않은 매장 ID입니다.' }, { status: 400 })
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const month = searchParams.get('month') || 'current'

    // Check if store exists
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, name, code, address')
      .eq('id', storeId)
      .single()

    if (storeError || !store) {
      return NextResponse.json({ error: '매장을 찾을 수 없습니다.' }, { status: 404 })
    }

    // Calculate date ranges
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    // Current month dates
    const currentMonthStart = new Date(currentYear, currentMonth, 1)
    const currentMonthEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999)

    // Previous month dates
    const previousMonthStart = new Date(currentYear, currentMonth - 1, 1)
    const previousMonthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999)

    // 6 months ago start date for trend
    const sixMonthsAgo = new Date(currentYear, currentMonth - 5, 1)

    try {
      // Get current month sales
      const { data: currentSales, error: currentSalesError } = await supabase
        .from('sales_transactions')
        .select('total_amount, sold_at')
        .eq('store_id', storeId)
        .gte('sold_at', currentMonthStart.toISOString())
        .lte('sold_at', currentMonthEnd.toISOString())

      if (currentSalesError) {
        console.error('Current sales error:', currentSalesError)
        throw new Error('현재 월 매출 조회 실패')
      }

      // Get previous month sales for comparison
      const { data: previousSales, error: previousSalesError } = await supabase
        .from('sales_transactions')
        .select('total_amount')
        .eq('store_id', storeId)
        .gte('sold_at', previousMonthStart.toISOString())
        .lte('sold_at', previousMonthEnd.toISOString())

      if (previousSalesError) {
        console.error('Previous sales error:', previousSalesError)
        throw new Error('이전 월 매출 조회 실패')
      }

      // Get 6-month trend data
      const { data: trendSales, error: trendSalesError } = await supabase
        .from('sales_transactions')
        .select('total_amount, sold_at')
        .eq('store_id', storeId)
        .gte('sold_at', sixMonthsAgo.toISOString())
        .lte('sold_at', currentMonthEnd.toISOString())

      if (trendSalesError) {
        console.error('Trend sales error:', trendSalesError)
        throw new Error('6개월 매출 트렌드 조회 실패')
      }

      // Calculate totals
      const currentTotal = currentSales?.reduce((sum, sale) => sum + (sale.total_amount || 0), 0) || 0
      const previousTotal = previousSales?.reduce((sum, sale) => sum + (sale.total_amount || 0), 0) || 0

      // Calculate percentage change
      const percentageChange = previousTotal > 0 
        ? ((currentTotal - previousTotal) / previousTotal) * 100 
        : currentTotal > 0 ? 100 : 0

      // Process trend data (group by month)
      const trendData = []
      for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(currentYear, currentMonth - i, 1)
        const monthEnd = new Date(currentYear, currentMonth - i + 1, 0, 23, 59, 59, 999)
        
        const monthSales = trendSales?.filter(sale => {
          const saleDate = new Date(sale.sold_at)
          return saleDate >= monthDate && saleDate <= monthEnd
        }) || []
        
        const monthTotal = monthSales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0)
        
        trendData.push({
          month: monthDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short' }),
          total: monthTotal,
          count: monthSales.length
        })
      }

      // Get additional metrics for current month
      const currentSalesCount = currentSales?.length || 0
      const averageTransactionValue = currentSalesCount > 0 ? currentTotal / currentSalesCount : 0

      // Get today's sales for additional insight
      const today = new Date()
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)

      const todaySales = currentSales?.filter(sale => {
        const saleDate = new Date(sale.sold_at)
        return saleDate >= todayStart && saleDate <= todayEnd
      }) || []

      const todayTotal = todaySales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0)

      const salesData = {
        store: {
          id: store.id,
          name: store.name,
          code: store.code,
          address: store.address
        },
        current_month: {
          total: currentTotal,
          count: currentSalesCount,
          average_transaction: averageTransactionValue,
          period: `${currentMonthStart.getFullYear()}.${(currentMonthStart.getMonth() + 1).toString().padStart(2, '0')}`
        },
        previous_month: {
          total: previousTotal,
          count: previousSales?.length || 0,
          period: `${previousMonthStart.getFullYear()}.${(previousMonthStart.getMonth() + 1).toString().padStart(2, '0')}`
        },
        comparison: {
          change_amount: currentTotal - previousTotal,
          change_percentage: Math.round(percentageChange * 100) / 100,
          is_increase: currentTotal >= previousTotal
        },
        today: {
          total: todayTotal,
          count: todaySales.length
        },
        trend: trendData,
        generated_at: new Date().toISOString()
      }

      return NextResponse.json({
        success: true,
        data: salesData
      })

    } catch (queryError) {
      console.error('Sales query error:', queryError)
      return NextResponse.json({ 
        error: queryError instanceof Error ? queryError.message : '매출 데이터 조회 실패' 
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Store sales API error:', error)
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다.' 
    }, { status: 500 })
  }
}