import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/sales/[id] - 특정 판매 기록 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { data: sale, error: saleError } = await supabase
      .from('sales_records')
      .select(`
        *,
        sales_items (
          *,
          products (
            id,
            name,
            unit,
            category_id,
            product_categories (
              id,
              name
            )
          )
        ),
        stores (
          id,
          name,
          code
        ),
        profiles!recorded_by (
          id,
          name
        ),
        profiles!canceled_by (
          id,
          name
        )
      `)
      .eq('id', params.id)
      .single()

    if (saleError) {
      if (saleError.code === 'PGRST116') {
        return NextResponse.json({ error: '판매 기록을 찾을 수 없습니다.' }, { status: 404 })
      }
      console.error('Sale fetch error:', saleError)
      return NextResponse.json({ error: '판매 기록 조회 실패' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: sale
    })

  } catch (error) {
    console.error('Sales API error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// DELETE /api/sales/[id] - 판매 기록 취소
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // 권한 확인 - 매니저 이상만 취소 가능
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['super_admin', 'admin', 'manager'].includes(profile.role)) {
      return NextResponse.json({ error: '판매 취소 권한이 없습니다.' }, { status: 403 })
    }

    // 요청 데이터
    const body = await request.json()
    const { reason } = body

    // 판매 기록 취소 (stock restoration 포함)
    const { data: result, error: cancelError } = await supabase
      .rpc('cancel_sales_transaction', {
        p_sale_id: params.id,
        p_reason: reason || null
      })

    if (cancelError) {
      console.error('Cancel error:', cancelError)
      return NextResponse.json({ error: '판매 취소 실패' }, { status: 500 })
    }

    if (!result) {
      return NextResponse.json({ error: '이미 취소된 판매이거나 존재하지 않습니다.' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: '판매가 취소되었습니다.'
    })

  } catch (error) {
    console.error('Sales API error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}