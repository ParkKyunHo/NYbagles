import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/sales - 판매 기록 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // 직원 정보 확인
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('store_id, stores(id, name)')
      .eq('user_id', user.id)
      .single()

    if (employeeError || !employee) {
      return NextResponse.json({ error: '직원 정보를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 요청 데이터 파싱
    const body = await request.json()
    const { items, payment_method, notes } = body

    // 유효성 검사
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: '판매 항목이 필요합니다.' }, { status: 400 })
    }

    if (!payment_method || !['cash', 'card', 'transfer', 'mobile', 'other'].includes(payment_method)) {
      return NextResponse.json({ error: '유효한 결제 방법을 선택하세요.' }, { status: 400 })
    }

    // 판매 기록 생성
    const { data: saleId, error: saleError } = await supabase
      .rpc('create_sales_transaction', {
        p_store_id: employee.store_id,
        p_items: items,
        p_payment_method: payment_method,
        p_notes: notes || null
      })

    if (saleError) {
      console.error('Sale creation error:', saleError)
      return NextResponse.json({ error: '판매 기록 생성 실패' }, { status: 500 })
    }

    // 생성된 판매 기록 조회
    const { data: saleRecord, error: fetchError } = await supabase
      .from('sales_transactions')
      .select(`
        *,
        sales_items (
          *,
          products (
            id,
            name,
            unit
          )
        ),
        stores (
          id,
          name
        ),
        profiles:sold_by (
          id,
          full_name
        )
      `)
      .eq('id', saleId)
      .single()

    if (fetchError) {
      console.error('Fetch error:', fetchError)
      return NextResponse.json({ 
        success: true, 
        sale_id: saleId,
        message: '판매 기록이 생성되었습니다.' 
      }, { status: 201 })
    }

    return NextResponse.json({ 
      success: true,
      data: saleRecord 
    }, { status: 201 })

  } catch (error) {
    console.error('Sales API error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// GET /api/sales - 판매 기록 조회
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
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const storeId = searchParams.get('store_id')
    const paymentMethod = searchParams.get('payment_method')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // 기본 쿼리
    let query = supabase
      .from('sales_transactions')
      .select(`
        *,
        sales_items (
          *,
          products (
            id,
            name,
            unit,
            category
          )
        ),
        stores (
          id,
          name,
          code
        ),
        seller:profiles!sold_by (
          id,
          full_name
        )
      `, { count: 'exact' })
      .order('sold_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // 필터 적용
    if (startDate) {
      const startDateTime = new Date(startDate)
      startDateTime.setHours(0, 0, 0, 0)
      query = query.gte('sold_at', startDateTime.toISOString())
    }
    if (endDate) {
      const endDateTime = new Date(endDate)
      endDateTime.setHours(23, 59, 59, 999)
      query = query.lte('sold_at', endDateTime.toISOString())
    }
    if (storeId) {
      query = query.eq('store_id', storeId)
    }
    if (paymentMethod) {
      query = query.eq('payment_method', paymentMethod)
    }

    const { data: sales, error: salesError, count } = await query

    if (salesError) {
      console.error('Sales fetch error:', salesError)
      return NextResponse.json({ error: '판매 기록 조회 실패' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: sales,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (offset + limit) < (count || 0)
      }
    })

  } catch (error) {
    console.error('Sales API error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}