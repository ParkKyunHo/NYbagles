import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server-admin'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      )
    }
    
    // 요청 본문 파싱
    const { productId, storeId, price } = await request.json()
    
    if (!productId || !storeId || !price) {
      return NextResponse.json(
        { error: '필수 정보가 누락되었습니다' },
        { status: 400 }
      )
    }
    
    // 1. 판매 트랜잭션 생성
    const { data: transaction, error: transactionError } = await adminClient
      .from('sales_transactions')
      .insert({
        store_id: storeId,
        total_amount: price,
        payment_method: 'cash',
        status: 'completed',
        created_by: user.id
      })
      .select()
      .single()
    
    if (transactionError) {
      console.error('Transaction error:', transactionError)
      throw transactionError
    }
    
    // 2. 판매 아이템 추가
    const { error: itemError } = await adminClient
      .from('sales_items')
      .insert({
        transaction_id: transaction.id,
        product_id: productId,
        quantity: 1,
        unit_price: price,
        subtotal: price
      })
    
    if (itemError) {
      console.error('Item error:', itemError)
      throw itemError
    }
    
    // 3. 재고 차감 - 먼저 현재 재고 확인
    const { data: product } = await adminClient
      .from('products')
      .select('stock_quantity')
      .eq('id', productId)
      .single()
    
    if (!product || product.stock_quantity <= 0) {
      return NextResponse.json(
        { error: '재고가 부족합니다' },
        { status: 400 }
      )
    }
    
    const { error: stockError } = await adminClient
      .from('products')
      .update({ 
        stock_quantity: product.stock_quantity - 1
      })
      .eq('id', productId)
    
    if (stockError) {
      console.error('Stock error:', stockError)
      throw stockError
    }
    
    return NextResponse.json({
      success: true,
      transactionId: transaction.id
    })
    
  } catch (error) {
    console.error('Quick sale error:', error)
    return NextResponse.json(
      { error: '판매 처리 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}