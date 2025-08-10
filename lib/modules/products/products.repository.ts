/**
 * Products Repository
 * 상품 데이터 접근 계층 - 데이터베이스 작업 격리
 */

import { Injectable, Cacheable, Log } from '@/lib/core/decorators'
import { ServiceScope } from '@/lib/core/types'
import { createAdminClient } from '@/lib/supabase/server-admin'
import { SupabaseClient } from '@supabase/supabase-js'

export interface Product {
  id: string
  name: string
  sku: string
  price: number
  cost: number
  category: string
  stock_quantity: number
  min_stock: number
  store_id: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ProductFilter {
  storeId?: string
  category?: string
  isActive?: boolean
  search?: string
  limit?: number
  offset?: number
}

export interface CreateProductRequest {
  name: string
  sku: string
  price: number
  cost: number
  category: string
  stock_quantity: number
  min_stock: number
  store_id: string
  is_active?: boolean
}

export interface UpdateProductRequest {
  name?: string
  price?: number
  cost?: number
  category?: string
  stock_quantity?: number
  min_stock?: number
  is_active?: boolean
}

export interface ProductChange {
  id: string
  product_id: string
  change_type: 'create' | 'update' | 'delete'
  changes: Record<string, any>
  status: 'pending' | 'approved' | 'rejected'
  requested_by: string
  approved_by?: string
  created_at: string
}

@Injectable({ scope: ServiceScope.SINGLETON })
export class ProductsRepository {
  private supabase: SupabaseClient

  constructor() {
    this.supabase = createAdminClient()
  }

  /**
   * Get products list with filters
   */
  async getProducts(filter: ProductFilter): Promise<{
    data: Product[]
    total: number
  }> {
    let query = this.supabase
      .from('products')
      .select('*', { count: 'exact' })

    // Apply filters
    if (filter.storeId) {
      query = query.eq('store_id', filter.storeId)
    }
    if (filter.category) {
      query = query.eq('category', filter.category)
    }
    if (filter.isActive !== undefined) {
      query = query.eq('is_active', filter.isActive)
    }
    if (filter.search) {
      query = query.or(`name.ilike.%${filter.search}%,sku.ilike.%${filter.search}%`)
    }

    // Apply pagination
    const limit = filter.limit || 50
    const offset = filter.offset || 0
    query = query.range(offset, offset + limit - 1)
    query = query.order('name', { ascending: true })

    const { data, error, count } = await query

    if (error) {
      throw new Error(`Failed to fetch products: ${error.message}`)
    }

    return {
      data: data || [],
      total: count || 0
    }
  }

  /**
   * Get single product by ID
   */
    async getProductById(id: string): Promise<Product | null> {
    const { data, error } = await this.supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // Not found
      }
      throw new Error(`Failed to fetch product: ${error.message}`)
    }

    return data as Product
  }

  /**
   * Get product by SKU
   */
    async getProductBySku(sku: string, storeId?: string): Promise<Product | null> {
    let query = this.supabase
      .from('products')
      .select('*')
      .eq('sku', sku)

    if (storeId) {
      query = query.eq('store_id', storeId)
    }

    const { data, error } = await query.single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // Not found
      }
      throw new Error(`Failed to fetch product by SKU: ${error.message}`)
    }

    return data as Product
  }

  /**
   * Create a new product
   */
    async createProduct(data: CreateProductRequest, userId: string): Promise<Product> {
    // Check if SKU already exists
    const existing = await this.getProductBySku(data.sku, data.store_id)
    if (existing) {
      throw new Error(`Product with SKU ${data.sku} already exists`)
    }

    const { data: product, error } = await this.supabase
      .from('products')
      .insert({
        ...data,
        is_active: data.is_active !== undefined ? data.is_active : true
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create product: ${error.message}`)
    }

    // Create inventory movement record
    await this.createInventoryMovement({
      product_id: product.id,
      movement_type: 'initial',
      quantity: data.stock_quantity,
      reference_type: 'product_creation',
      reference_id: product.id,
      created_by: userId
    })

    return product as Product
  }

  /**
   * Update a product
   */
    async updateProduct(
    id: string,
    data: UpdateProductRequest,
    userId: string
  ): Promise<Product> {
    const existing = await this.getProductById(id)
    if (!existing) {
      throw new Error('Product not found')
    }

    // If stock is being updated, create inventory movement
    if (data.stock_quantity !== undefined && data.stock_quantity !== existing.stock_quantity) {
      const difference = data.stock_quantity - existing.stock_quantity
      await this.createInventoryMovement({
        product_id: id,
        movement_type: difference > 0 ? 'restock' : 'adjustment',
        quantity: difference,
        reference_type: 'manual_adjustment',
        reference_id: id,
        created_by: userId
      })
    }

    const { data: product, error } = await this.supabase
      .from('products')
      .update({
        ...data,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update product: ${error.message}`)
    }

    return product as Product
  }

  /**
   * Delete a product (soft delete)
   */
    async deleteProduct(id: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('products')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to delete product: ${error.message}`)
    }

    return true
  }

  /**
   * Create product change request (for approval workflow)
   */
    async createProductChangeRequest(
    productId: string | null,
    changeType: 'create' | 'update' | 'delete',
    changes: Record<string, any>,
    userId: string
  ): Promise<ProductChange> {
    const { data, error } = await this.supabase
      .from('product_changes')
      .insert({
        product_id: productId,
        change_type: changeType,
        changes,
        status: 'pending',
        requested_by: userId
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create change request: ${error.message}`)
    }

    return data as ProductChange
  }

  /**
   * Get pending product changes
   */
    async getPendingChanges(storeId?: string): Promise<ProductChange[]> {
    let query = this.supabase
      .from('product_changes')
      .select(`
        *,
        products!inner(
          store_id
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (storeId) {
      query = query.eq('products.store_id', storeId)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch pending changes: ${error.message}`)
    }

    return data || []
  }

  /**
   * Approve product change
   */
    async approveChange(changeId: string, userId: string): Promise<boolean> {
    const { data: change, error: fetchError } = await this.supabase
      .from('product_changes')
      .select('*')
      .eq('id', changeId)
      .single()

    if (fetchError || !change) {
      throw new Error('Change request not found')
    }

    if (change.status !== 'pending') {
      throw new Error('Change request is not pending')
    }

    // Apply the change
    if (change.change_type === 'create') {
      await this.createProduct(change.changes, userId)
    } else if (change.change_type === 'update' && change.product_id) {
      await this.updateProduct(change.product_id, change.changes, userId)
    } else if (change.change_type === 'delete' && change.product_id) {
      await this.deleteProduct(change.product_id)
    }

    // Update change status
    const { error: updateError } = await this.supabase
      .from('product_changes')
      .update({
        status: 'approved',
        approved_by: userId,
        approved_at: new Date().toISOString()
      })
      .eq('id', changeId)

    if (updateError) {
      throw new Error(`Failed to approve change: ${updateError.message}`)
    }

    return true
  }

  /**
   * Reject product change
   */
    async rejectChange(changeId: string, userId: string, reason?: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('product_changes')
      .update({
        status: 'rejected',
        approved_by: userId,
        approved_at: new Date().toISOString(),
        rejection_reason: reason
      })
      .eq('id', changeId)

    if (error) {
      throw new Error(`Failed to reject change: ${error.message}`)
    }

    return true
  }

  /**
   * Update product stock
   */
  async updateStock(productId: string, quantityChange: number): Promise<void> {
    const { error } = await this.supabase.rpc('update_product_stock', {
      p_product_id: productId,
      p_quantity_change: quantityChange
    })

    if (error) {
      throw new Error(`Failed to update stock: ${error.message}`)
    }
  }

  /**
   * Get low stock products
   */
    async getLowStockProducts(storeId?: string): Promise<Product[]> {
    let query = this.supabase
      .from('products')
      .select('*')
      .filter('stock_quantity', 'lte', 'min_stock')
      .eq('is_active', true)

    if (storeId) {
      query = query.eq('store_id', storeId)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch low stock products: ${error.message}`)
    }

    return data || []
  }

  /**
   * Get product categories
   */
    async getCategories(storeId?: string): Promise<string[]> {
    let query = this.supabase
      .from('products')
      .select('category')

    if (storeId) {
      query = query.eq('store_id', storeId)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch categories: ${error.message}`)
    }

    // Extract unique categories
    const categories = new Set(data?.map(p => p.category) || [])
    return Array.from(categories).filter(c => c).sort()
  }

  /**
   * Create inventory movement record
   */
  private async createInventoryMovement(data: {
    product_id: string
    movement_type: string
    quantity: number
    reference_type: string
    reference_id: string
    created_by: string
  }): Promise<void> {
    const { error } = await this.supabase
      .from('inventory_movements')
      .insert(data)

    if (error) {
      console.error('Failed to create inventory movement:', error)
      // Don't throw - inventory tracking shouldn't fail the main operation
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details?: any }> {
    try {
      const { error } = await this.supabase
        .from('products')
        .select('id')
        .limit(1)

      return {
        status: error ? 'unhealthy' : 'healthy',
        details: error ? { error: error.message } : undefined
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: (error as Error).message }
      }
    }
  }
}