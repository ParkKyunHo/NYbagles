/**
 * Products Module
 * 상품 모듈 - 의존성 주입 설정 및 모듈 구성
 */

import { Module } from '@/lib/core/decorators'
import { ServiceProvider } from '@/lib/core/types'
import { ProductsRepository } from './products.repository'
import { ProductsService } from './products.service'
import { container } from '@/lib/core/container'

// Module providers
const providers: ServiceProvider[] = [
  {
    provide: 'ProductsRepository',
    useClass: ProductsRepository
  },
  {
    provide: 'ProductsService',
    useClass: ProductsService,
    deps: ['ProductsRepository']
  }
]

// Module exports
const exports = ['ProductsService']

/**
 * Products Module Configuration
 */
@Module({
  providers,
  exports
})
export class ProductsModule {
  static forRoot(config?: {
    enableCircuitBreaker?: boolean
    enableCaching?: boolean
    maxRetries?: number
  }) {
    // Register module with configuration
    container.registerModule('ProductsModule', providers, [], exports)
    
    // Apply configuration if provided
    if (config) {
      container.register({
        provide: 'ProductsConfig',
        useValue: config
      })
    }

    return ProductsModule
  }

  /**
   * Initialize module
   */
  static async initialize(): Promise<void> {
    const service = container.resolve<ProductsService>('ProductsService')
    
    // Perform health check
    const health = await service.healthCheck()
    
    if (health.status === 'unhealthy') {
      console.warn('Products module initialized with warnings:', health.details)
    } else {
      console.log('Products module initialized successfully')
    }
  }

  /**
   * Destroy module
   */
  static async destroy(): Promise<void> {
    // Clean up resources if needed
    console.log('Products module destroyed')
  }
}

// Export service interfaces
export { ProductsService } from './products.service'
export { ProductsRepository } from './products.repository'
export { ProductsError } from './products.errors'
export type { 
  Product,
  ProductFilter,
  CreateProductRequest,
  UpdateProductRequest,
  ProductChange
} from './products.repository'