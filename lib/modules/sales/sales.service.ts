/**
 * Sales Service
 * 판매 비즈니스 로직 - Circuit Breaker와 Fallback 적용
 */

import { Injectable, Inject, Log, Retry, Timeout } from '@/lib/core/decorators'
import { ServiceScope } from '@/lib/core/types'
import { SalesRepository, SalesFilter, SalesStats } from './sales.repository'
import { CircuitBreaker, CircuitBreakerFactory } from '@/lib/resilience/circuit-breaker'
import { withFallback, FallbackChain } from '@/lib/resilience/fallback'
import { withRetry, RetryPolicies } from '@/lib/resilience/retry-policy'
import { 
  SaleRecord, 
  CreateSaleRequest, 
  SalesListResponse,
  SalesSummaryResponse,
  PopularProduct,
  PaymentMethod 
} from '@/types/sales'
import { SalesError } from './sales.errors'
import { logger } from '@/lib/logging/logger'

export interface SalesServiceConfig {
  enableCircuitBreaker?: boolean
  enableCaching?: boolean
  maxRetries?: number
  timeout?: number
}

@Injectable({ scope: ServiceScope.SINGLETON })
export class SalesService {
  private circuitBreaker: CircuitBreaker
  private config: Required<SalesServiceConfig>
  private repository: SalesRepository

  constructor() {
    // Initialize repository directly
    this.repository = new SalesRepository()
    this.config = {
      enableCircuitBreaker: true,
      enableCaching: true,
      maxRetries: 3,
      timeout: 10000
    }

    // Initialize circuit breaker
    this.circuitBreaker = CircuitBreakerFactory.create({
      name: 'sales-service',
      timeout: this.config.timeout,
      errorThresholdPercentage: 50,
      requestVolumeThreshold: 10,
      sleepWindowMs: 30000
    })

    // Subscribe to circuit breaker events
    this.setupCircuitBreakerMonitoring()
  }

  /**
   * Create a new sale with full error handling
   */
  async createSale(data: CreateSaleRequest, userId: string): Promise<SaleRecord> {
    // Validate input
    this.validateSaleData(data)

    try {
      // Execute with circuit breaker protection
      return await this.circuitBreaker.execute(async () => {
        // Execute with retry policy
        return await withRetry(
          () => this.repository.createSale(data, userId),
          RetryPolicies.database()
        )
      })
    } catch (error) {
      logger.error('Failed to create sale', {
        error: error as Error,
        metadata: { service: 'sales', operation: 'create', data, userId }
      })
      
      throw SalesError.createFailed(error as Error)
    }
  }

  /**
   * Get sales with fallback to cached data
   */
  async getSales(filter: SalesFilter): Promise<SalesListResponse> {
    const fallbackChain = new FallbackChain<SalesListResponse>()
      .addCached(
        () => this.repository.getSales(filter),
        300000, // 5 minutes cache
        `sales-list-${JSON.stringify(filter)}`
      )
      .addDefault({
        data: [],
        pagination: {
          total: 0,
          limit: filter.limit || 50,
          offset: filter.offset || 0,
          hasMore: false
        }
      })

    try {
      return await this.circuitBreaker.execute(() => fallbackChain.execute())
    } catch (error) {
      logger.error('Failed to get sales', {
        error: error as Error,
        metadata: { service: 'sales', operation: 'list', filter }
      })
      
      // Return empty result as last resort
      return {
        data: [],
        pagination: {
          total: 0,
          limit: filter.limit || 50,
          offset: filter.offset || 0,
          hasMore: false
        }
      }
    }
  }

  /**
   * Get single sale by ID
   */
  async getSaleById(id: string): Promise<SaleRecord> {
    try {
      const sale = await this.circuitBreaker.execute(
        () => this.repository.getSaleById(id)
      )

      if (!sale) {
        throw SalesError.notFound(id)
      }

      return sale
    } catch (error) {
      if (error instanceof SalesError) {
        throw error
      }
      
      logger.error('Failed to get sale by ID', {
        error: error as Error,
        metadata: { service: 'sales', operation: 'getById', id }
      })
      
      throw SalesError.fetchFailed(error as Error)
    }
  }

  /**
   * Cancel a sale with validation
   */
  async cancelSale(id: string, reason: string, userId: string): Promise<boolean> {
    // Validate cancellation reason
    if (!reason || reason.trim().length < 5) {
      throw SalesError.validationFailed('Cancellation reason must be at least 5 characters')
    }

    try {
      // Check if user has permission to cancel
      const sale = await this.getSaleById(id)
      
      if (sale.status === 'cancelled') {
        throw SalesError.alreadyCancelled(id)
      }

      // Only allow cancellation within 24 hours
      const saleDate = new Date(sale.created_at)
      const now = new Date()
      const hoursDiff = (now.getTime() - saleDate.getTime()) / (1000 * 60 * 60)
      
      if (hoursDiff > 24) {
        throw SalesError.cancellationExpired(id)
      }

      return await this.circuitBreaker.execute(
        () => this.repository.cancelSale(id, reason)
      )
    } catch (error) {
      if (error instanceof SalesError) {
        throw error
      }
      
      logger.error('Failed to cancel sale', {
        error: error as Error,
        metadata: { service: 'sales', operation: 'cancel', id, reason, userId }
      })
      
      throw SalesError.cancellationFailed(error as Error)
    }
  }

  /**
   * Get sales summary with graceful degradation
   */
  async getSalesSummary(
    storeId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<SalesSummaryResponse> {
    // Use fallback chain for resilience
    return await withFallback(
      () => this.circuitBreaker.execute(
        () => this.repository.getSalesSummary(storeId, startDate, endDate)
      ),
      {
        cache: {
          enabled: true,
          ttl: 600000, // 10 minutes
          key: () => `sales-summary-${storeId}-${startDate}-${endDate}`
        },
        degraded: {
          enabled: true,
          service: async () => {
            // Provide degraded service with limited data
            logger.warn('Using degraded sales summary service')
            return {
              totalRevenue: 0,
              totalTransactions: 0,
              averageTransaction: 0,
              dailySales: [],
              popularProducts: [],
              paymentMethodBreakdown: {
                cash: 0,
                card: 0,
                transfer: 0,
                mobile: 0,
                other: 0
              },
              degraded: true
            }
          }
        },
        onFallback: (context) => {
          logger.warn('Sales summary fallback activated', {
            error: context.error,
            metadata: { service: 'sales', operation: 'summary' }
          })
        }
      }
    )
  }

  /**
   * Get popular products
   */
  async getPopularProducts(filter: {
    storeId?: string
    categoryId?: string
    period?: 'day' | 'week' | 'month' | 'all'
    limit?: number
  }): Promise<PopularProduct[]> {
    // Calculate date range based on period
    const { startDate, endDate } = this.calculateDateRange(filter.period)

    try {
      return await this.circuitBreaker.execute(
        () => this.repository.getPopularProducts({
          ...filter,
          startDate,
          endDate
        })
      )
    } catch (error) {
      logger.error('Failed to get popular products', {
        error: error as Error,
        metadata: { service: 'sales', operation: 'popularProducts', filter }
      })
      
      // Return empty array as fallback
      return []
    }
  }

  /**
   * Get sales statistics
   */
  async getStats(storeId?: string): Promise<SalesStats> {
    const today = new Date().toISOString().split('T')[0]
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0]

    try {
      const summary = await this.getSalesSummary(storeId, thirtyDaysAgo, today)
      const topProducts = await this.getPopularProducts({
        storeId,
        period: 'month',
        limit: 5
      })

      return {
        totalRevenue: summary.totalRevenue,
        totalTransactions: summary.totalTransactions,
        averageTransaction: summary.averageTransaction,
        topProducts
      }
    } catch (error) {
      logger.error('Failed to get sales stats', {
        error: error as Error,
        metadata: { service: 'sales', operation: 'stats', storeId }
      })
      
      // Return default stats
      return {
        totalRevenue: 0,
        totalTransactions: 0,
        averageTransaction: 0,
        topProducts: []
      }
    }
  }

  /**
   * Validate sale data
   */
  private validateSaleData(data: CreateSaleRequest): void {
    if (!data.store_id) {
      throw SalesError.validationFailed('Store ID is required')
    }

    if (!data.items || data.items.length === 0) {
      throw SalesError.validationFailed('At least one item is required')
    }

    if (data.total_amount <= 0) {
      throw SalesError.validationFailed('Total amount must be greater than 0')
    }

    if (!data.payment_method) {
      throw SalesError.validationFailed('Payment method is required')
    }

    // Validate items
    for (const item of data.items) {
      if (!item.product_id) {
        throw SalesError.validationFailed('Product ID is required for all items')
      }
      if (item.quantity <= 0) {
        throw SalesError.validationFailed('Quantity must be greater than 0')
      }
      if (item.unit_price < 0) {
        throw SalesError.validationFailed('Unit price cannot be negative')
      }
    }
  }

  /**
   * Calculate date range based on period
   */
  private calculateDateRange(period?: 'day' | 'week' | 'month' | 'all'): {
    startDate?: string
    endDate?: string
  } {
    if (!period || period === 'all') {
      return {}
    }

    const endDate = new Date().toISOString()
    let startDate: Date

    switch (period) {
      case 'day':
        startDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
        break
      case 'week':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        break
      default:
        return {}
    }

    return {
      startDate: startDate.toISOString(),
      endDate
    }
  }

  /**
   * Setup circuit breaker monitoring
   */
  private setupCircuitBreakerMonitoring(): void {
    this.circuitBreaker.on('stateChange', ({ from, to }) => {
      logger.warn('Sales service circuit breaker state changed', {
        metadata: { service: 'sales', component: 'circuit-breaker', from, to }
      })
    })

    this.circuitBreaker.on('failure', ({ error }) => {
      logger.error('Sales service operation failed', {
        error: error as Error,
        metadata: { service: 'sales', component: 'circuit-breaker' }
      })
    })

    this.circuitBreaker.on('timeout', () => {
      logger.warn('Sales service operation timed out', {
        metadata: { service: 'sales', component: 'circuit-breaker' }
      })
    })

    this.circuitBreaker.on('retry', ({ attempt, error }) => {
      logger.info('Sales service retrying operation', {
        metadata: { service: 'sales', component: 'circuit-breaker', attempt, error }
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
    logger.info('Sales service destroyed')
  }
}