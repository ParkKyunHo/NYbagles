'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server-admin'
import { requireRole, getAuthUser } from '@/lib/auth/unified-auth'
import { redirect } from 'next/navigation'

export interface CreateProductInput {
  name: string
  description?: string
  sku: string
  category: string
  base_price: number
  sale_price?: number
  stock_quantity: number
  min_stock_level?: number
  max_stock_level?: number
  store_id: string
}

export interface UpdateProductInput extends Partial<CreateProductInput> {
  id: string
}

/**
 * 상품 생성 Server Action
 */
export async function createProduct(input: CreateProductInput) {
  const user = await requireRole(['super_admin', 'admin', 'manager'])
  const adminClient = createAdminClient()
  
  // 매니저는 자신의 매장 상품만 생성 가능
  if (user.role === 'manager' && input.store_id !== user.storeId) {
    throw new Error('다른 매장의 상품을 생성할 수 없습니다')
  }
  
  try {
    const { data, error } = await adminClient
      .from('products')
      .insert({
        ...input,
        status: 'active',
        created_by: user.id,
        created_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) throw error
    
    // 캐시 무효화
    revalidateTag('products')
    revalidatePath('/products')
    
    return {
      success: true,
      product: data,
      message: '상품이 생성되었습니다'
    }
  } catch (error) {
    console.error('Product creation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '상품 생성 중 오류가 발생했습니다'
    }
  }
}

/**
 * 상품 수정 Server Action
 */
export async function updateProduct(input: UpdateProductInput) {
  const user = await getAuthUser()
  const adminClient = createAdminClient()
  
  // 권한 체크
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    throw new Error('상품 수정 권한이 없습니다')
  }
  
  try {
    // 기존 상품 조회
    const { data: existingProduct } = await adminClient
      .from('products')
      .select('store_id')
      .eq('id', input.id)
      .single()
    
    if (!existingProduct) {
      throw new Error('상품을 찾을 수 없습니다')
    }
    
    // 매니저는 자신의 매장 상품만 수정 가능
    if (user.role === 'manager' && existingProduct.store_id !== user.storeId) {
      throw new Error('다른 매장의 상품을 수정할 수 없습니다')
    }
    
    const { id, ...updateData } = input
    
    const { data, error } = await adminClient
      .from('products')
      .update({
        ...updateData,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    
    // 캐시 무효화
    revalidateTag('products')
    revalidatePath('/products')
    revalidatePath(`/products/${id}`)
    
    return {
      success: true,
      product: data,
      message: '상품이 수정되었습니다'
    }
  } catch (error) {
    console.error('Product update error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '상품 수정 중 오류가 발생했습니다'
    }
  }
}

/**
 * 상품 삭제 Server Action (비활성화)
 */
export async function deleteProduct(productId: string) {
  const user = await getAuthUser()
  const adminClient = createAdminClient()
  
  // 권한 체크 (슈퍼 관리자와 관리자만)
  if (!['super_admin', 'admin'].includes(user.role)) {
    throw new Error('상품 삭제 권한이 없습니다')
  }
  
  try {
    const { error } = await adminClient
      .from('products')
      .update({
        status: 'inactive',
        updated_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', productId)
    
    if (error) throw error
    
    // 캐시 무효화
    revalidateTag('products')
    revalidatePath('/products')
    
    return {
      success: true,
      message: '상품이 삭제되었습니다'
    }
  } catch (error) {
    console.error('Product deletion error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '상품 삭제 중 오류가 발생했습니다'
    }
  }
}

/**
 * 재고 조정 Server Action
 */
export async function adjustStock(productId: string, quantity: number, reason: string) {
  const user = await getAuthUser()
  const adminClient = createAdminClient()
  
  // 권한 체크
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    throw new Error('재고 조정 권한이 없습니다')
  }
  
  try {
    // 기존 상품 조회
    const { data: product } = await adminClient
      .from('products')
      .select('stock_quantity, store_id')
      .eq('id', productId)
      .single()
    
    if (!product) {
      throw new Error('상품을 찾을 수 없습니다')
    }
    
    // 매니저는 자신의 매장 상품만 조정 가능
    if (user.role === 'manager' && product.store_id !== user.storeId) {
      throw new Error('다른 매장의 재고를 조정할 수 없습니다')
    }
    
    const newQuantity = product.stock_quantity + quantity
    
    if (newQuantity < 0) {
      throw new Error('재고가 음수가 될 수 없습니다')
    }
    
    // 재고 업데이트
    const { error: updateError } = await adminClient
      .from('products')
      .update({
        stock_quantity: newQuantity,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', productId)
    
    if (updateError) throw updateError
    
    // 재고 이동 기록
    const { error: movementError } = await adminClient
      .from('inventory_movements')
      .insert({
        product_id: productId,
        movement_type: quantity > 0 ? 'in' : 'out',
        quantity: Math.abs(quantity),
        reason,
        created_by: user.id,
        created_at: new Date().toISOString()
      })
    
    if (movementError) throw movementError
    
    // 캐시 무효화
    revalidateTag('products')
    revalidateTag('stock')
    revalidatePath('/products')
    
    return {
      success: true,
      message: `재고가 ${quantity > 0 ? '증가' : '감소'}되었습니다`,
      newQuantity
    }
  } catch (error) {
    console.error('Stock adjustment error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '재고 조정 중 오류가 발생했습니다'
    }
  }
}

/**
 * 카테고리 관리 Server Actions
 */
export async function createCategory(name: string, displayOrder: number = 0) {
  const user = await getAuthUser()
  const adminClient = createAdminClient()
  
  // 권한 체크
  if (!['super_admin', 'admin'].includes(user.role)) {
    throw new Error('카테고리 생성 권한이 없습니다')
  }
  
  try {
    const { data, error } = await adminClient
      .from('product_categories')
      .insert({
        name,
        display_order: displayOrder,
        is_active: true
      })
      .select()
      .single()
    
    if (error) throw error
    
    revalidateTag('categories')
    
    return {
      success: true,
      category: data,
      message: '카테고리가 생성되었습니다'
    }
  } catch (error) {
    console.error('Category creation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '카테고리 생성 중 오류가 발생했습니다'
    }
  }
}

export async function updateCategory(id: string, name: string, displayOrder: number) {
  const user = await getAuthUser()
  const adminClient = createAdminClient()
  
  // 권한 체크
  if (!['super_admin', 'admin'].includes(user.role)) {
    throw new Error('카테고리 수정 권한이 없습니다')
  }
  
  try {
    const { data, error } = await adminClient
      .from('product_categories')
      .update({
        name,
        display_order: displayOrder
      })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    
    revalidateTag('categories')
    
    return {
      success: true,
      category: data,
      message: '카테고리가 수정되었습니다'
    }
  } catch (error) {
    console.error('Category update error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '카테고리 수정 중 오류가 발생했습니다'
    }
  }
}

export async function deleteCategory(id: string) {
  const user = await getAuthUser()
  const adminClient = createAdminClient()
  
  // 권한 체크
  if (!['super_admin', 'admin'].includes(user.role)) {
    throw new Error('카테고리 삭제 권한이 없습니다')
  }
  
  try {
    const { error } = await adminClient
      .from('product_categories')
      .update({ is_active: false })
      .eq('id', id)
    
    if (error) throw error
    
    revalidateTag('categories')
    
    return {
      success: true,
      message: '카테고리가 삭제되었습니다'
    }
  } catch (error) {
    console.error('Category deletion error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '카테고리 삭제 중 오류가 발생했습니다'
    }
  }
}