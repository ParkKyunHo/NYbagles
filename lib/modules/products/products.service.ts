/**
 * Products Service
 * 상품 비즈니스 로직 - Circuit Breaker와 Fallback 적용
 */

import { Injectable, Inject, Log, Retry, Timeout, Cacheable } from '@/lib/core/decorators'
import { ServiceScope } from '@/lib/core/types'
import { 
  ProductsRepository, 
  Product, 
  ProductFilter, 
  CreateProductRequest,
  UpdateProductRequest,
  ProductChange
} from './products.repository'
import { CircuitBreaker, CircuitBreakerFactory } from '@/lib/resilience/circuit-breaker'
import { withFallback, FallbackChain } from '@/lib/resilience/fallback'
import { withRetry, RetryPolicies } from '@/lib/resilience/retry-policy'
import { ProductsError } from './products.errors'
import { logger } from '@/lib/logging/logger'

export interface ProductsServiceConfig {
  enableCircuitBreaker?: boolean
  enableCaching?: boolean
  maxRetries?: number
  timeout?: number
}

export interface ProductStats {
  totalProducts: number
  activeProducts: number
  lowStockProducts: number
  categories: string[]
  totalValue: number
}

@Injectable({ scope: ServiceScope.SINGLETON })
export class ProductsService {
  private circuitBreaker: CircuitBreaker
  private config: Required<ProductsServiceConfig>
  private repository: ProductsRepository

  constructor() {
    // Initialize repository directly
    this.repository = new ProductsRepository()
    this.config = {
      enableCircuitBreaker: true,
      enableCaching: true,
      maxRetries: 3,
      timeout: 10000
    }

    // Initialize circuit breaker
    this.circuitBreaker = CircuitBreakerFactory.create({
      name: 'products-service',
      timeout: this.config.timeout,
      errorThresholdPercentage: 50,
      requestVolumeThreshold: 10,
      sleepWindowMs: 30000
    })

    // Subscribe to circuit breaker events
    this.setupCircuitBreakerMonitoring()
  }

  /**
   * Get products with fallback to cached data
   */
  async getProducts(filter: ProductFilter): Promise<{
    data: Product[]
    total: number
  }> {
    const fallbackChain = new FallbackChain<{ data: Product[]; total: number }>()
      .addCached(
        () => this.repository.getProducts(filter),
        300000, // 5 minutes cache
        `products-list-${JSON.stringify(filter)}`
      )
      .addDefault({
        data: [],
        total: 0
      })

    try {
      return await this.circuitBreaker.execute(() => fallbackChain.execute())
    } catch (error) {
      logger.error('Failed to get products', {
        error: error as Error,
        metadata: { service: 'products', operation: 'list', filter }
      })
      
      // Return empty result as last resort
      return {
        data: [],
        total: 0
      }
    }
  }

  /**
   * Get single product by ID
   */
  async getProductById(id: string): Promise<Product> {
    try {
      const product = await this.circuitBreaker.execute(
        () => this.repository.getProductById(id)
      )

      if (!product) {
        throw ProductsError.notFound(id)
      }

      return product
    } catch (error) {
      if (error instanceof ProductsError) {
        throw error
      }
      
      logger.error('Failed to get product by ID', {
        error: error as Error,
        metadata: { service: 'products', operation: 'getById', id }
      })
      
      throw ProductsError.fetchFailed(error as Error)
    }
  }

  /**
   * Get product by SKU
   */
  async getProductBySku(sku: string, storeId?: string): Promise<Product> {
    try {
      const product = await this.circuitBreaker.execute(
        () => this.repository.getProductBySku(sku, storeId)
      )

      if (!product) {
        throw ProductsError.skuNotFound(sku)
      }

      return product
    } catch (error) {
      if (error instanceof ProductsError) {
        throw error
      }
      
      logger.error('Failed to get product by SKU', {
        error: error as Error,
        metadata: { service: 'products', operation: 'getBySku', sku, storeId }
      })
      
      throw ProductsError.fetchFailed(error as Error)
    }
  }

  /**
   * Create a new product with validation
   */
  async createProduct(data: CreateProductRequest, userId: string): Promise<Product> {
    // Validate input
    this.validateProductData(data)

    try {
      // Check for duplicate SKU
      const existing = await this.repository.getProductBySku(data.sku, data.store_id)
      if (existing) {
        throw ProductsError.duplicateSku(data.sku)
      }

      // Execute with circuit breaker protection
      return await this.circuitBreaker.execute(async () => {
        // Execute with retry policy
        return await withRetry(
          () => this.repository.createProduct(data, userId),
          RetryPolicies.database()
        )
      })
    } catch (error) {
      if (error instanceof ProductsError) {
        throw error
      }
      
      logger.error('Failed to create product', {
        error: error as Error,
        metadata: { service: 'products', operation: 'create', data, userId }
      })
      
      throw ProductsError.createFailed(error as Error)
    }
  }

  /**
   * Update a product with validation
   */
  async updateProduct(
    id: string,
    data: UpdateProductRequest,
    userId: string
  ): Promise<Product> {
    // Validate update data
    if (data.price !== undefined && data.price < 0) {
      throw ProductsError.validationFailed('Price cannot be negative')
    }
    
    if (data.stock_quantity !== undefined && data.stock_quantity < 0) {
      throw ProductsError.validationFailed('Stock quantity cannot be negative')
    }

    try {
      // Check if product exists
      const existing = await this.getProductById(id)
      
      if (!existing) {
        throw ProductsError.notFound(id)
      }

      return await this.circuitBreaker.execute(
        () => this.repository.updateProduct(id, data, userId)
      )
    } catch (error) {
      if (error instanceof ProductsError) {
        throw error
      }
      
      logger.error('Failed to update product', {
        error: error as Error,
        metadata: { service: 'products', operation: 'update', id, data, userId }
      })
      
      throw ProductsError.updateFailed(error as Error)
    }
  }

  /**
   * Delete a product (soft delete)
   */
  async deleteProduct(id: string, userId: string): Promise<boolean> {
    try {
      // Check if product exists
      const product = await this.getProductById(id)
      
      if (!product) {
        throw ProductsError.notFound(id)
      }

      // Check if product has active sales
      // This would need additional logic to check sales_items table
      
      return await this.circuitBreaker.execute(
        () => this.repository.deleteProduct(id)
      )
    } catch (error) {
      if (error instanceof ProductsError) {
        throw error
      }
      
      logger.error('Failed to delete product', {
        error: error as Error,
        metadata: { service: 'products', operation: 'delete', id, userId }
      })
      
      throw ProductsError.deleteFailed(error as Error)
    }
  }

  /**
   * Create product change request for approval
   */
  async requestProductChange(
    productId: string | null,
    changeType: 'create' | 'update' | 'delete',
    changes: Record<string, any>,
    userId: string
  ): Promise<ProductChange> {
    try {
      return await this.circuitBreaker.execute(
        () => this.repository.createProductChangeRequest(productId, changeType, changes, userId)
      )
    } catch (error) {
      logger.error('Failed to create change request', {
        error: error as Error,
        metadata: { service: 'products', operation: 'requestChange', productId, changeType, userId }
      })
      
      throw ProductsError.changeRequestFailed(error as Error)
    }
  }

  /**
   * Get pending product changes
   */
  async getPendingChanges(storeId?: string): Promise<ProductChange[]> {
    try {
      return await withFallback(
        () => this.circuitBreaker.execute(
          () => this.repository.getPendingChanges(storeId)
        ),
        {
          cache: {
            enabled: true,
            ttl: 60000, // 1 minute
            key: () => `pending-changes-${storeId}`
          },
          default: []
        }
      )
    } catch (error) {
      logger.error('Failed to get pending changes', {
        error: error as Error,
        metadata: { service: 'products', operation: 'getPendingChanges', storeId }
      })
      
      return []
    }
  }

  /**
   * Approve product change
   */
  async approveChange(changeId: string, userId: string): Promise<boolean> {
    try {
      return await this.circuitBreaker.execute(
        () => this.repository.approveChange(changeId, userId)
      )
    } catch (error) {
      logger.error('Failed to approve change', {
        error: error as Error,
        metadata: { service: 'products', operation: 'approveChange', changeId, userId }
      })
      
      throw ProductsError.approvalFailed(error as Error)
    }
  }

  /**
   * Reject product change
   */
  async rejectChange(changeId: string, userId: string, reason?: string): Promise<boolean> {
    if (!reason || reason.trim().length < 5) {
      throw ProductsError.validationFailed('Rejection reason must be at least 5 characters')
    }

    try {
      return await this.circuitBreaker.execute(
        () => this.repository.rejectChange(changeId, userId, reason)
      )
    } catch (error) {
      logger.error('Failed to reject change', {
        error: error as Error,
        metadata: { service: 'products', operation: 'rejectChange', changeId, userId, reason }
      })
      
      throw ProductsError.rejectionFailed(error as Error)
    }
  }

  /**
   * Update product stock
   */
  async updateStock(productId: string, quantityChange: number): Promise<void> {
    try {
      await this.circuitBreaker.execute(
        () => this.repository.updateStock(productId, quantityChange)
      )
    } catch (error) {
      logger.error('Failed to update stock', {
        error: error as Error,
        metadata: { service: 'products', operation: 'updateStock', productId, quantityChange }
      })
      
      throw ProductsError.stockUpdateFailed(error as Error)
    }
  }

  /**
   * Get low stock products
   */
  async getLowStockProducts(storeId?: string): Promise<Product[]> {
    try {
      return await this.circuitBreaker.execute(
        () => this.repository.getLowStockProducts(storeId)
      )
    } catch (error) {
      logger.error('Failed to get low stock products', {
        error: error as Error,
        metadata: { service: 'products', operation: 'getLowStock', storeId }
      })
      
      return []
    }
  }

  /**
   * Get product categories
   */
  async getCategories(storeId?: string): Promise<string[]> {
    try {
      return await this.circuitBreaker.execute(
        () => this.repository.getCategories(storeId)
      )
    } catch (error) {
      logger.error('Failed to get categories', {
        error: error as Error,
        metadata: { service: 'products', operation: 'getCategories', storeId }
      })
      
      return []
    }
  }

  /**
   * Get product statistics
   */
  async getStats(storeId?: string): Promise<ProductStats> {
    try {
      const [products, lowStock, categories] = await Promise.all([
        this.getProducts({ storeId, isActive: true }),
        this.getLowStockProducts(storeId),
        this.getCategories(storeId)
      ])

      const totalValue = products.data.reduce((sum, p) => 
        sum + (p.price * p.stock_quantity), 0
      )

      return {
        totalProducts: products.total,
        activeProducts: products.data.filter(p => p.is_active).length,
        lowStockProducts: lowStock.length,
        categories,
        totalValue
      }
    } catch (error) {
      logger.error('Failed to get product stats', {
        error: error as Error,
        metadata: { service: 'products', operation: 'stats', storeId }
      })
      
      // Return default stats
      return {
        totalProducts: 0,
        activeProducts: 0,
        lowStockProducts: 0,
        categories: [],
        totalValue: 0
      }
    }
  }

  /**
   * Validate product data
   */
  private validateProductData(data: CreateProductRequest): void {
    if (!data.name || data.name.trim().length < 2) {
      throw ProductsError.validationFailed('Product name must be at least 2 characters')
    }

    if (!data.sku || data.sku.trim().length < 3) {
      throw ProductsError.validationFailed('SKU must be at least 3 characters')
    }

    if (data.price < 0) {
      throw ProductsError.validationFailed('Price cannot be negative')
    }

    if (data.cost < 0) {
      throw ProductsError.validationFailed('Cost cannot be negative')
    }

    if (data.stock_quantity < 0) {
      throw ProductsError.validationFailed('Stock quantity cannot be negative')
    }

    if (data.min_stock < 0) {
      throw ProductsError.validationFailed('Minimum stock cannot be negative')
    }

    if (!data.category) {
      throw ProductsError.validationFailed('Category is required')
    }

    if (!data.store_id) {
      throw ProductsError.validationFailed('Store ID is required')
    }
  }

  /**
   * Setup circuit breaker monitoring
   */
  private setupCircuitBreakerMonitoring(): void {
    this.circuitBreaker.on('stateChange', ({ from, to }) => {
      logger.warn('Products service circuit breaker state changed', {
        metadata: { service: 'products', component: 'circuit-breaker', from, to }
      })
    })

    this.circuitBreaker.on('failure', ({ error }) => {
      logger.error('Products service operation failed', {
        error,
        metadata: { service: 'products', component: 'circuit-breaker' }
      })
    })

    this.circuitBreaker.on('timeout', () => {
      logger.warn('Products service operation timed out', {
        metadata: { service: 'products', component: 'circuit-breaker' }
      })
    })

    this.circuitBreaker.on('retry', ({ attempt, error }) => {
      logger.info('Products service retrying operation', {
        metadata: { service: 'products', component: 'circuit-breaker', attempt, error }
      })
    })
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details?: any }> {
    const circuitState = this.circuitBreaker.getState()
    const circuitStats = this.circuitBreaker.getStats()
    const repositoryHealth = await this.repository.healthCheck()

    const isHealthy = circuitState !== 'open' && repositoryHealth.status === 'healthy'

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      details: {
        circuit: {
          state: circuitState,
          stats: circuitStats
        },
        repository: repositoryHealth
      }
    }
  }

  /**
   * Cleanup resources
   */
  async onDestroy(): Promise<void> {
    this.circuitBreaker.destroy()
    logger.info('Products service destroyed')
  }
}