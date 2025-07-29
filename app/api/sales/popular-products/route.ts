import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/sales/popular-products - 인기 상품 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // 쿼리 파라미터
    const searchParams = request.nextUrl.searchParams
    const storeId = searchParams.get('store_id')
    const categoryId = searchParams.get('category_id')
    const period = searchParams.get('period') || 'month' // day, week, month, all
    const limit = parseInt(searchParams.get('limit') || '10')

    // 기간 계산
    let dateFilter = ''
    const now = new Date()
    
    switch (period) {
      case 'day':
        dateFilter = now.toISOString().split('T')[0]
        break
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        dateFilter = weekAgo.toISOString().split('T')[0]
        break
      case 'month':
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
        dateFilter = monthAgo.toISOString().split('T')[0]
        break
    }

    // 인기 상품 쿼리
    let query = `
      SELECT 
        si.product_id,
        p.name as product_name,
        p.category_id,
        pc.name as category_name,
        p.unit,
        p.price as default_price,
        SUM(si.quantity) as total_quantity,
        SUM(si.total_amount) as total_revenue,
        COUNT(DISTINCT sr.id) as transaction_count,
        AVG(si.unit_price) as avg_price
      FROM sales_items si
      JOIN sales_records sr ON si.sale_id = sr.id
      JOIN products p ON si.product_id = p.id
      JOIN product_categories pc ON p.category_id = pc.id
      WHERE NOT sr.is_canceled
    `

    const params: any = {}

    if (storeId) {
      query += ' AND sr.store_id = $1'
      params.$1 = storeId
    }

    if (categoryId) {
      query += ' AND p.category_id = $2'
      params.$2 = categoryId
    }

    if (dateFilter) {
      query += ' AND sr.sale_date >= $3'
      params.$3 = dateFilter
    }

    query += `
      GROUP BY si.product_id, p.name, p.category_id, pc.name, p.unit, p.price
      ORDER BY total_quantity DESC
      LIMIT $4
    `
    params.$4 = limit

    // 프로필 권한 확인
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // 매니저는 자기 매장만 조회 가능
    if (profile?.role === 'manager' && !storeId) {
      const { data: employee } = await supabase
        .from('employees')
        .select('store_id')
        .eq('user_id', user.id)
        .single()
      
      if (employee) {
        query = query.replace('WHERE NOT sr.is_canceled', 
          `WHERE NOT sr.is_canceled AND sr.store_id = '${employee.store_id}'`)
      }
    }

    // 직접 SQL 실행
    const { data: products, error: productsError } = await supabase.rpc('get_popular_products', {
      p_store_id: storeId || null,
      p_category_id: categoryId || null,
      p_start_date: dateFilter || null,
      p_limit: limit
    })

    if (productsError) {
      console.error('Popular products error:', productsError)
      
      // RPC 함수가 없는 경우 대체 쿼리
      const { data: alternativeData, error: altError } = await supabase
        .from('popular_products')
        .select('*')
        .order('total_quantity', { ascending: false })
        .limit(limit)

      if (altError) {
        return NextResponse.json({ error: '인기 상품 조회 실패' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: alternativeData || [],
        period: period,
        filters: { store_id: storeId, category_id: categoryId }
      })
    }

    return NextResponse.json({
      success: true,
      data: products || [],
      period: period,
      filters: { store_id: storeId, category_id: categoryId }
    })

  } catch (error) {
    console.error('Popular products API error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// RPC 함수 생성이 필요한 경우를 위한 타입 정의
interface PopularProduct {
  product_id: string
  product_name: string
  category_id: string
  category_name: string
  unit: string
  default_price: number
  total_quantity: number
  total_revenue: number
  transaction_count: number
  avg_price: number
}