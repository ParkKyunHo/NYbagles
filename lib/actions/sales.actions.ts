'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server-admin'
import { requireAuth, getAuthUser } from '@/lib/auth/unified-auth'

export interface CreateSaleInput {
  productId: string
  quantity: number
  unitPrice: number
  paymentMethod: 'cash' | 'card' | 'mobile'
}

/**
 * 판매 생성 Server Action
 * 트랜잭션 처리 및 재고 관리
 */
export async function createSale(input: CreateSaleInput) {
  const user = await requireAuth()
  const adminClient = createAdminClient()
  
  try {
    // 트랜잭션 시작
    const { data: product } = await adminClient
      .from('products')
      .select('stock_quantity, name')
      .eq('id', input.productId)
      .single()
    
    if (!product || product.stock_quantity < input.quantity) {
      throw new Error('재고가 부족합니다')
    }
    
    // 직원 정보 조회
    const { data: employee } = await adminClient
      .from('employees')
      .select('id, store_id')
      .eq('user_id', user.id)
      .single()
    
    if (!employee) {
      throw new Error('직원 정보를 찾을 수 없습니다')
    }
    
    // 1. 판매 기록 생성
    const { data: saleRecord, error: saleError } = await adminClient
      .from('sales_records')
      .insert({
        store_id: employee.store_id,
        employee_id: employee.id,
        total_amount: input.unitPrice * input.quantity,
        payment_method: input.paymentMethod,
        status: 'completed'
      })
      .select()
      .single()
    
    if (saleError) throw saleError
    
    // 2. 판매 아이템 생성
    const { error: itemError } = await adminClient
      .from('sales_items')
      .insert({
        transaction_id: saleRecord.id,
        product_id: input.productId,
        quantity: input.quantity,
        unit_price: input.unitPrice,
        subtotal: input.unitPrice * input.quantity
      })
    
    if (itemError) throw itemError
    
    // 3. 재고 업데이트
    const { error: stockError } = await adminClient
      .from('products')
      .update({ 
        stock_quantity: product.stock_quantity - input.quantity
      })
      .eq('id', input.productId)
    
    if (stockError) throw stockError
    
    // 캐시 무효화
    revalidateTag('sales')
    revalidateTag('products')
    revalidatePath('/sales')
    revalidatePath('/dashboard')
    
    return {
      success: true,
      transactionId: saleRecord.id,
      message: `${product.name} ${input.quantity}개 판매 완료`
    }
  } catch (error) {
    console.error('Sale creation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '판매 처리 중 오류가 발생했습니다'
    }
  }
}

/**
 * 판매 취소 Server Action
 */
export async function cancelSale(transactionId: string) {
  const user = await getAuthUser()
  const adminClient = createAdminClient()
  
  // 권한 체크 (매니저 이상만 취소 가능)
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    throw new Error('판매 취소 권한이 없습니다')
  }
  
  try {
    // 트랜잭션 정보 조회
    const { data: transaction } = await adminClient
      .from('sales_transactions')
      .select(`
        *,
        sales_items(
          product_id,
          quantity
        )
      `)
      .eq('id', transactionId)
      .single()
    
    if (!transaction) {
      throw new Error('거래를 찾을 수 없습니다')
    }
    
    if (transaction.status === 'cancelled') {
      throw new Error('이미 취소된 거래입니다')
    }
    
    // 1. 트랜잭션 상태 업데이트
    const { error: updateError } = await adminClient
      .from('sales_transactions')
      .update({ 
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.id
      })
      .eq('id', transactionId)
    
    if (updateError) throw updateError
    
    // 2. 재고 복구
    for (const item of transaction.sales_items) {
      const { error: stockError } = await adminClient.rpc(
        'increment_stock',
        { 
          p_product_id: item.product_id,
          p_quantity: item.quantity 
        }
      )
      
      if (stockError) throw stockError
    }
    
    // 캐시 무효화
    revalidateTag('sales')
    revalidateTag('products')
    revalidatePath('/sales')
    
    return {
      success: true,
      message: '판매가 취소되었습니다'
    }
  } catch (error) {
    console.error('Sale cancellation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '취소 처리 중 오류가 발생했습니다'
    }
  }
}

/**
 * 일일 마감 Server Action
 */
export async function closeDailySales(date: string) {
  const user = await getAuthUser()
  const adminClient = createAdminClient()
  
  // 권한 체크
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    throw new Error('마감 권한이 없습니다')
  }
  
  try {
    // 마감 데이터 생성
    const { data: summary } = await adminClient.rpc(
      'create_daily_closing',
      {
        p_store_id: user.storeId,
        p_closing_date: date,
        p_created_by: user.id
      }
    )
    
    // 캐시 무효화
    revalidateTag('sales')
    revalidatePath('/sales/closing')
    
    return {
      success: true,
      summary,
      message: '일일 마감이 완료되었습니다'
    }
  } catch (error) {
    console.error('Daily closing error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '마감 처리 중 오류가 발생했습니다'
    }
  }
}