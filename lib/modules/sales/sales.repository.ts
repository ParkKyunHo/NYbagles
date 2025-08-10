/**
 * Sales Repository
 * 판매 데이터 접근 계층 - 데이터베이스 작업 격리
 */

import { Injectable, Cacheable, Log } from '@/lib/core/decorators'
import { ServiceScope } from '@/lib/core/types'
import { createAdminClient } from '@/lib/supabase/server-admin'
import { SupabaseClient } from '@supabase/supabase-js'
import { 
  SaleRecord, 
  CreateSaleRequest, 
  SalesListResponse,
  SalesSummaryResponse,
  PopularProduct,
  PaymentMethod 
} from '@/types/sales'

export interface SalesFilter {
  startDate?: string
  endDate?: string
  storeId?: string
  paymentMethod?: PaymentMethod
  status?: 'completed' | 'cancelled' | 'pending'
  limit?: number
  offset?: number
}

export interface SalesStats {
  totalRevenue: number
  totalTransactions: number
  averageTransaction: number
  topProducts: PopularProduct[]
}

@Injectable({ scope: ServiceScope.SINGLETON })
export class SalesRepository {
  private supabase: SupabaseClient

  constructor() {
    this.supabase = createAdminClient()
  }

  /**
   * Create a new sale transaction
   */
    async createSale(data: CreateSaleRequest, userId: string): Promise<SaleRecord> {
    // Start transaction
    const { data: transaction, error: transactionError } = await this.supabase
      .from('sales_transactions')
      .insert({
        store_id: data.store_id,
        employee_id: userId,
        total_amount: data.total_amount,
        tax_amount: data.tax_amount || 0,
        discount_amount: data.discount_amount || 0,
        payment_method: data.payment_method,
        status: 'completed',
        customer_phone: data.customer_phone,
        notes: data.notes
      })
      .select()
      .single()

    if (transactionError) {
      throw new Error(`Failed to create transaction: ${transactionError.message}`)
    }

    // Insert sale items
    if (data.items && data.items.length > 0) {
      const saleItems = data.items.map(item => ({
        transaction_id: transaction.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
        discount_amount: item.discount_amount || 0
      }))

      const { error: itemsError } = await this.supabase
        .from('sales_items')
        .insert(saleItems)

      if (itemsError) {
        // Rollback transaction
        await this.cancelSale(transaction.id)
        throw new Error(`Failed to create sale items: ${itemsError.message}`)
      }

      // Update product stock
      for (const item of data.items) {
        await this.updateProductStock(item.product_id, -item.quantity)
      }
    }

    return transaction as SaleRecord
  }

  /**
   * Get sales list with filters
   */
      async getSales(filter: SalesFilter): Promise<SalesListResponse> {
    let query = this.supabase
      .from('sales_transactions')
      .select(`
        *,
        sales_items (
          *,
          products (
            id,
            name,
            sku
          )
        ),
        employees (
          id,
          name
        ),
        stores (
          id,
          name
        )
      `, { count: 'exact' })

    // Apply filters
    if (filter.startDate) {
      query = query.gte('created_at', filter.startDate)
    }
    if (filter.endDate) {
      query = query.lte('created_at', filter.endDate)
    }
    if (filter.storeId) {
      query = query.eq('store_id', filter.storeId)
    }
    if (filter.paymentMethod) {
      query = query.eq('payment_method', filter.paymentMethod)
    }
    if (filter.status) {
      query = query.eq('status', filter.status)
    }

    // Apply pagination
    const limit = filter.limit || 50
    const offset = filter.offset || 0
    query = query.range(offset, offset + limit - 1)
    query = query.order('created_at', { ascending: false })

    const { data, error, count } = await query

    if (error) {
      throw new Error(`Failed to fetch sales: ${error.message}`)
    }

    return {
      data: data || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit
      }
    }
  }

  /**
   * Get single sale by ID
   */
    async getSaleById(id: string): Promise<SaleRecord | null> {
    const { data, error } = await this.supabase
      .from('sales_transactions')
      .select(`
        *,
        sales_items (
          *,
          products (
            id,
            name,
            sku,
            price
          )
        ),
        employees (
          id,
          name,
          email
        ),
        stores (
          id,
          name,
          address
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // Not found
      }
      throw new Error(`Failed to fetch sale: ${error.message}`)
    }

    return data as SaleRecord
  }

  /**
   * Cancel a sale
   */
    async cancelSale(id: string, reason?: string): Promise<boolean> {
    // Get sale details first
    const sale = await this.getSaleById(id)
    if (!sale) {
      throw new Error('Sale not found')
    }

    if (sale.status === 'cancelled') {
      throw new Error('Sale is already cancelled')
    }

    // Update sale status
    const { error: updateError } = await this.supabase
      .from('sales_transactions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason
      })
      .eq('id', id)

    if (updateError) {
      throw new Error(`Failed to cancel sale: ${updateError.message}`)
    }

    // Restore product stock
    if (sale.sales_items) {
      for (const item of sale.sales_items) {
        await this.updateProductStock(item.product_id, item.quantity)
      }
    }

    return true
  }

  /**
   * Get sales summary statistics
   */
      async getSalesSummary(
    storeId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<SalesSummaryResponse> {
    // Get total sales
    let query = this.supabase
      .from('sales_transactions')
      .select('total_amount')
      .eq('status', 'completed')

    if (storeId) query = query.eq('store_id', storeId)
    if (startDate) query = query.gte('created_at', startDate)
    if (endDate) query = query.lte('created_at', endDate)

    const { data: salesData, error: salesError } = await query

    if (salesError) {
      throw new Error(`Failed to fetch sales summary: ${salesError.message}`)
    }

    const totalRevenue = salesData?.reduce((sum, s) => sum + Number(s.total_amount), 0) || 0
    const totalTransactions = salesData?.length || 0
    const averageTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0

    // Get daily sales
    const { data: dailySales, error: dailyError } = await this.supabase
      .rpc('get_daily_sales', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_store_id: storeId
      })

    if (dailyError) {
      console.error('Failed to fetch daily sales:', dailyError)
    }

    // Get popular products
    const popularProducts = await this.getPopularProducts({
      storeId,
      startDate,
      endDate,
      limit: 10
    })

    return {
      totalRevenue,
      totalTransactions,
      averageTransaction,
      dailySales: dailySales || [],
      popularProducts: popularProducts || [],
      paymentMethodBreakdown: await this.getPaymentMethodBreakdown(storeId, startDate, endDate)
    }
  }

  /**
   * Get popular products
   */
    async getPopularProducts(filter: {
    storeId?: string
    categoryId?: string
    startDate?: string
    endDate?: string
    limit?: number
  }): Promise<PopularProduct[]> {
    const { data, error } = await this.supabase
      .rpc('get_popular_products', {
        p_store_id: filter.storeId,
        p_category_id: filter.categoryId,
        p_start_date: filter.startDate,
        p_end_date: filter.endDate,
        p_limit: filter.limit || 10
      })

    if (error) {
      console.error('Failed to fetch popular products:', error)
      return []
    }

    return data || []
  }

  /**
   * Get payment method breakdown
   */
  private async getPaymentMethodBreakdown(
    storeId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<Record<PaymentMethod, number>> {
    let query = this.supabase
      .from('sales_transactions')
      .select('payment_method, total_amount')
      .eq('status', 'completed')

    if (storeId) query = query.eq('store_id', storeId)
    if (startDate) query = query.gte('created_at', startDate)
    if (endDate) query = query.lte('created_at', endDate)

    const { data, error } = await query

    if (error) {
      console.error('Failed to fetch payment breakdown:', error)
      return {
        cash: 0,
        card: 0,
        transfer: 0,
        mobile: 0,
        other: 0
      }
    }

    const breakdown: Record<PaymentMethod, number> = {
      cash: 0,
      card: 0,
      transfer: 0,
      mobile: 0,
      other: 0
    }

    data?.forEach(transaction => {
      const method = transaction.payment_method as PaymentMethod
      breakdown[method] = (breakdown[method] || 0) + Number(transaction.total_amount)
    })

    return breakdown
  }

  /**
   * Update product stock
   */
  private async updateProductStock(productId: string, quantityChange: number): Promise<void> {
    const { error } = await this.supabase.rpc('update_product_stock', {
      p_product_id: productId,
      p_quantity_change: quantityChange
    })

    if (error) {
      console.error(`Failed to update stock for product ${productId}:`, error)
      // Don't throw - stock update failure shouldn't fail the sale
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details?: any }> {
    try {
      const { error } = await this.supabase
        .from('sales_transactions')
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