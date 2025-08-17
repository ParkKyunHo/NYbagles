'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getCachedAuthUser } from '@/lib/auth/unified-auth';

export interface UpdateStockData {
  productId: string;
  newQuantity: number;
  reason?: string;
}

export interface UpdateStockResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
}

/**
 * 재고 수량 직접 업데이트 (승인 불필요)
 * 권한: manager, admin, super_admin만 가능
 */
export async function updateProductStock(data: UpdateStockData): Promise<UpdateStockResult> {
  try {
    const supabase = await createClient();
    
    // 현재 사용자 확인 및 권한 체크
    const authUser = await getCachedAuthUser();
    
    if (!authUser) {
      return {
        success: false,
        error: '인증되지 않은 요청입니다.'
      };
    }

    // 권한 체크: manager, admin, super_admin만 가능
    const allowedRoles = ['manager', 'admin', 'super_admin'];
    if (!allowedRoles.includes(authUser.role)) {
      return {
        success: false,
        error: '재고 수정 권한이 없습니다. 매니저 이상의 권한이 필요합니다.'
      };
    }

    // 유효성 검사
    if (data.newQuantity < 0) {
      return {
        success: false,
        error: '재고 수량은 0 이상이어야 합니다.'
      };
    }

    // 현재 상품 정보 조회
    const { data: currentProduct, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('id', data.productId)
      .single();

    if (fetchError || !currentProduct) {
      return {
        success: false,
        error: '상품을 찾을 수 없습니다.'
      };
    }

    // 재고 업데이트
    const { data: updatedProduct, error: updateError } = await supabase
      .from('products')
      .update({
        stock_quantity: data.newQuantity,
        updated_at: new Date().toISOString()
      })
      .eq('id', data.productId)
      .select()
      .single();

    if (updateError) {
      console.error('Stock update error:', updateError);
      return {
        success: false,
        error: '재고 업데이트 중 오류가 발생했습니다.'
      };
    }

    // 재고 변경 이력 기록
    await supabase
      .from('product_changes')
      .insert({
        product_id: data.productId,
        change_type: 'stock_update',
        old_values: {
          stock_quantity: currentProduct.stock_quantity
        },
        new_values: {
          stock_quantity: data.newQuantity
        },
        change_reason: data.reason || '재고 수정',
        requested_by: authUser.id,
        approved_by: authUser.id,
        approved_at: new Date().toISOString(),
        status: 'approved'
      });

    // 캐시 무효화
    revalidatePath('/products');
    revalidatePath('/sales');
    revalidatePath('/dashboard');
    revalidatePath('/');
    revalidateTag('products');
    revalidateTag('sales');

    return {
      success: true,
      message: `재고가 ${data.newQuantity}개로 업데이트되었습니다.`,
      data: updatedProduct
    };

  } catch (error) {
    console.error('Stock update error:', error);
    return {
      success: false,
      error: '서버 오류가 발생했습니다.'
    };
  }
}

/**
 * 재고 조정 (증가/감소)
 * 권한: manager, admin, super_admin만 가능
 */
export async function adjustProductStock(
  productId: string, 
  adjustment: number, 
  reason?: string
): Promise<UpdateStockResult> {
  try {
    const supabase = await createClient();
    
    // 현재 사용자 확인 및 권한 체크
    const authUser = await getCachedAuthUser();
    
    if (!authUser) {
      return {
        success: false,
        error: '인증되지 않은 요청입니다.'
      };
    }

    // 권한 체크: manager, admin, super_admin만 가능
    const allowedRoles = ['manager', 'admin', 'super_admin'];
    if (!allowedRoles.includes(authUser.role)) {
      return {
        success: false,
        error: '재고 수정 권한이 없습니다. 매니저 이상의 권한이 필요합니다.'
      };
    }

    // 현재 재고 조회
    const { data: currentProduct, error: fetchError } = await supabase
      .from('products')
      .select('stock_quantity')
      .eq('id', productId)
      .single();

    if (fetchError || !currentProduct) {
      return {
        success: false,
        error: '상품을 찾을 수 없습니다.'
      };
    }

    const newQuantity = currentProduct.stock_quantity + adjustment;

    if (newQuantity < 0) {
      return {
        success: false,
        error: '재고가 부족합니다.'
      };
    }

    // updateProductStock 함수 활용
    return updateProductStock({
      productId,
      newQuantity,
      reason: reason || `재고 ${adjustment > 0 ? '증가' : '감소'}: ${Math.abs(adjustment)}개`
    });

  } catch (error) {
    console.error('Stock adjustment error:', error);
    return {
      success: false,
      error: '서버 오류가 발생했습니다.'
    };
  }
}

/**
 * 여러 상품의 재고 일괄 업데이트
 * 권한: manager, admin, super_admin만 가능
 */
export async function batchUpdateStock(
  updates: UpdateStockData[]
): Promise<UpdateStockResult> {
  try {
    const supabase = await createClient();
    
    // 현재 사용자 확인 및 권한 체크
    const authUser = await getCachedAuthUser();
    
    if (!authUser) {
      return {
        success: false,
        error: '인증되지 않은 요청입니다.'
      };
    }

    // 권한 체크: manager, admin, super_admin만 가능
    const allowedRoles = ['manager', 'admin', 'super_admin'];
    if (!allowedRoles.includes(authUser.role)) {
      return {
        success: false,
        error: '재고 수정 권한이 없습니다. 매니저 이상의 권한이 필요합니다.'
      };
    }

    const results = [];
    const errors = [];

    for (const update of updates) {
      const result = await updateProductStock(update);
      if (result.success) {
        results.push(result);
      } else {
        errors.push({
          productId: update.productId,
          error: result.error
        });
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        error: `일부 상품의 재고 업데이트에 실패했습니다.`,
        data: { results, errors }
      };
    }

    return {
      success: true,
      message: `${results.length}개 상품의 재고가 업데이트되었습니다.`,
      data: results
    };

  } catch (error) {
    console.error('Batch stock update error:', error);
    return {
      success: false,
      error: '서버 오류가 발생했습니다.'
    };
  }
}