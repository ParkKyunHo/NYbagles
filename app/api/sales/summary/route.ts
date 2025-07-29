import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/sales/summary - 매출 요약 정보 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // 권한 확인
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: '사용자 정보를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 쿼리 파라미터
    const searchParams = request.nextUrl.searchParams
    const storeId = searchParams.get('store_id')
    const startDate = searchParams.get('start_date') || new Date().toISOString().split('T')[0]
    const endDate = searchParams.get('end_date') || new Date().toISOString().split('T')[0]
    const groupBy = searchParams.get('group_by') || 'day' // day, week, month

    // 매니저는 자기 매장만 조회 가능
    let storeFilter = storeId
    if (profile.role === 'manager' && !storeFilter) {
      const { data: employee } = await supabase
        .from('employees')
        .select('store_id')
        .eq('user_id', user.id)
        .single()
      
      if (employee) {
        storeFilter = employee.store_id
      }
    }

    // 일일 매출 요약 조회
    let summaryQuery = supabase
      .from('daily_sales_summary')
      .select(`
        *,
        stores (
          id,
          name,
          code
        )
      `)
      .gte('sale_date', startDate)
      .lte('sale_date', endDate)
      .order('sale_date', { ascending: false })

    if (storeFilter) {
      summaryQuery = summaryQuery.eq('store_id', storeFilter)
    }

    const { data: summaries, error: summaryError } = await summaryQuery

    if (summaryError) {
      console.error('Summary fetch error:', summaryError)
      return NextResponse.json({ error: '매출 요약 조회 실패' }, { status: 500 })
    }

    // 기간별 집계
    let aggregatedData = summaries
    if (groupBy === 'week' || groupBy === 'month') {
      // 주간/월간 집계 로직
      const grouped = summaries.reduce((acc: any, item) => {
        const date = new Date(item.sale_date)
        let key: string
        
        if (groupBy === 'week') {
          const weekStart = new Date(date)
          weekStart.setDate(date.getDate() - date.getDay())
          key = weekStart.toISOString().split('T')[0]
        } else {
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        }

        if (!acc[key]) {
          acc[key] = {
            period: key,
            total_sales: 0,
            cash_sales: 0,
            card_sales: 0,
            other_sales: 0,
            transaction_count: 0,
            canceled_count: 0,
            days: 0,
            stores: item.stores
          }
        }

        acc[key].total_sales += parseFloat(item.total_sales || '0')
        acc[key].cash_sales += parseFloat(item.cash_sales || '0')
        acc[key].card_sales += parseFloat(item.card_sales || '0')
        acc[key].other_sales += parseFloat(item.other_sales || '0')
        acc[key].transaction_count += item.transaction_count || 0
        acc[key].canceled_count += item.canceled_count || 0
        acc[key].days += 1

        return acc
      }, {})

      aggregatedData = Object.values(grouped)
    }

    // 전체 요약 통계
    const totalStats = summaries.reduce((acc, item) => ({
      total_sales: acc.total_sales + parseFloat(item.total_sales || '0'),
      cash_sales: acc.cash_sales + parseFloat(item.cash_sales || '0'),
      card_sales: acc.card_sales + parseFloat(item.card_sales || '0'),
      other_sales: acc.other_sales + parseFloat(item.other_sales || '0'),
      transaction_count: acc.transaction_count + (item.transaction_count || 0),
      canceled_count: acc.canceled_count + (item.canceled_count || 0),
      days: acc.days + 1
    }), {
      total_sales: 0,
      cash_sales: 0,
      card_sales: 0,
      other_sales: 0,
      transaction_count: 0,
      canceled_count: 0,
      days: 0
    })

    // 평균 계산
    totalStats['daily_average'] = totalStats.days > 0 ? totalStats.total_sales / totalStats.days : 0
    totalStats['transaction_average'] = totalStats.transaction_count > 0 ? 
      totalStats.total_sales / totalStats.transaction_count : 0

    return NextResponse.json({
      success: true,
      data: {
        summaries: aggregatedData,
        total_stats: totalStats,
        period: {
          start_date: startDate,
          end_date: endDate,
          group_by: groupBy
        }
      }
    })

  } catch (error) {
    console.error('Sales summary API error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}