/**
 * Sales Module
 * 판매 모듈 - 의존성 주입 설정 및 모듈 구성
 */

import { Module } from '@/lib/core/decorators'
import { ServiceProvider } from '@/lib/core/types'
import { SalesRepository } from './sales.repository'
import { SalesService } from './sales.service'
import { container } from '@/lib/core/container'

// Module providers
const providers: ServiceProvider[] = [
  {
    provide: 'SalesRepository',
    useClass: SalesRepository
  },
  {
    provide: 'SalesService',
    useClass: SalesService,
    deps: ['SalesRepository']
  }
]

// Module exports
const exports = ['SalesService']

/**
 * Sales Module Configuration
 */
@Module({
  providers,
  exports
})
export class SalesModule {
  static forRoot(config?: {
    enableCircuitBreaker?: boolean
    enableCaching?: boolean
    maxRetries?: number
  }) {
    // Register module with configuration
    container.registerModule('SalesModule', providers, [], exports)
    
    // Apply configuration if provided
    if (config) {
      container.register({
        provide: 'SalesConfig',
        useValue: config
      })
    }

    return SalesModule
  }

  /**
   * Initialize module
   */
  static async initialize(): Promise<void> {
    const service = container.resolve<SalesService>('SalesService')
    
    // Perform health check
    const health = await service.healthCheck()
    
    if (health.status === 'unhealthy') {
      console.warn('Sales module initialized with warnings:', health.details)
    } else {
      console.log('Sales module initialized successfully')
    }
  }

  /**
   * Destroy module
   */
  static async destroy(): Promise<void> {
    // Clean up resources if needed
    console.log('Sales module destroyed')
  }
}

// Export service interfaces
export { SalesService } from './sales.service'
export { SalesRepository } from './sales.repository'
export { SalesError } from './sales.errors'
export type { SalesFilter, SalesStats } from './sales.repository'