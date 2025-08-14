/**
 * Products Data Layer
 * 서버 컴포넌트에서 사용할 상품 데이터 페칭 함수
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient, createSafeAdminClient } from '@/lib/supabase/server-admin'
import { unstable_cache } from 'next/cache'

export interface Product {
  id: string
  name: string
  description: string | null
  sku: string | null
  base_price: number
  sale_price: number | null
  category: string
  status: string
  stock_quantity: number
  store_id: string
  created_at: string
  updated_at: string
  stores?: {
    id: string
    name: string
    code: string
  } | null
}

export interface Category {
  id: string
  name: string
  display_order: number
  is_active: boolean
}

export interface Store {
  id: string
  name: string
  code: string
  is_active: boolean
}

export interface ProductFilters {
  storeId?: string | null
  category?: string
  searchTerm?: string
  status?: string
  limit?: number
}

/**
 * 상품 목록 조회 (캐싱 적용)
 */
export const getProducts = unstable_cache(
  async (filters: ProductFilters = {}): Promise<Product[]> => {
    const adminClient = createSafeAdminClient()
    
    let query = adminClient
      .from('products')
      .select(`
        *,
        stores (
          id,
          name,
          code
        )
      `)
    
    // 필터 적용
    if (filters.storeId) {
      query = query.eq('store_id', filters.storeId)
    }
    
    if (filters.category) {
      query = query.eq('category', filters.category)
    }
    
    if (filters.status) {
      query = query.eq('status', filters.status)
    } else {
      // 기본적으로 활성 상품만
      query = query.eq('status', 'active')
    }
    
    if (filters.searchTerm) {
      query = query.ilike('name', `%${filters.searchTerm}%`)
    }
    
    // 정렬 및 제한
    query = query
      .order('created_at', { ascending: false })
      .order('name', { ascending: true })
    
    if (filters.limit) {
      query = query.limit(filters.limit)
    }
    
    const { data, error } = await query
    
    if (error) throw error
    
    return data || []
  },
  ['products'],
  {
    revalidate: 300, // 5분 캐싱
    tags: ['products']
  }
)

/**
 * 단일 상품 조회
 */
export const getProduct = unstable_cache(
  async (productId: string): Promise<Product | null> => {
    const adminClient = createSafeAdminClient()
    
    const { data, error } = await adminClient
      .from('products')
      .select(`
        *,
        stores (
          id,
          name,
          code
        )
      `)
      .eq('id', productId)
      .single()
    
    if (error) {
      console.error('Error fetching product:', error)
      return null
    }
    
    return data
  },
  ['product'],
  {
    revalidate: 300,
    tags: ['products']
  }
)

/**
 * 카테고리 목록 조회
 */
export const getCategories = unstable_cache(
  async (): Promise<Category[]> => {
    const adminClient = createSafeAdminClient()
    
    const { data, error } = await adminClient
      .from('product_categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order')
    
    if (error) throw error
    
    return data || []
  },
  ['product-categories'],
  {
    revalidate: 3600, // 1시간 캐싱
    tags: ['categories']
  }
)

/**
 * 매장 목록 조회
 */
export const getStores = unstable_cache(
  async (): Promise<Store[]> => {
    const adminClient = createSafeAdminClient()
    
    const { data, error } = await adminClient
      .from('stores')
      .select('id, name, code, is_active')
      .eq('is_active', true)
      .order('name')
    
    if (error) throw error
    
    return data || []
  },
  ['stores'],
  {
    revalidate: 3600, // 1시간 캐싱
    tags: ['stores']
  }
)

/**
 * 상품 재고 상태 조회
 */
export const getProductStock = unstable_cache(
  async (storeId?: string | null): Promise<{
    lowStock: Product[]
    outOfStock: Product[]
    total: number
  }> => {
    const adminClient = createSafeAdminClient()
    
    let query = adminClient
      .from('products')
      .select('*')
      .eq('status', 'active')
    
    if (storeId) {
      query = query.eq('store_id', storeId)
    }
    
    const { data, error } = await query
    
    if (error) throw error
    
    const products = data || []
    
    return {
      lowStock: products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= 10),
      outOfStock: products.filter(p => p.stock_quantity === 0),
      total: products.length
    }
  },
  ['product-stock'],
  {
    revalidate: 60, // 1분 캐싱 (재고는 자주 변경됨)
    tags: ['products', 'stock']
  }
)

/**
 * 승인 대기 중인 상품 변경 조회
 */
export const getPendingProductChanges = unstable_cache(
  async (storeId?: string | null): Promise<number> => {
    const adminClient = createSafeAdminClient()
    
    if (storeId) {
      // Join with products table to filter by store
      const { count, error } = await adminClient
        .from('product_changes')
        .select(`
          id,
          product_id,
          products!inner(store_id)
        `, { count: 'exact', head: true })
        .eq('status', 'pending')
        .eq('products.store_id', storeId)
      
      if (error) throw error
      return count || 0
    } else {
      const { count, error } = await adminClient
        .from('product_changes')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
      
      if (error) throw error
      return count || 0
    }
  },
  ['pending-product-changes'],
  {
    revalidate: 60, // 1분 캐싱
    tags: ['product-changes']
  }
)