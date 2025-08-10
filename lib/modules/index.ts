/**
 * Module Registry
 * 모든 모듈을 중앙에서 관리하고 초기화
 */

import { SalesModule } from './sales/sales.module'
import { ProductsModule } from './products/products.module'
import { EmployeesModule } from './employees/employees.module'
import { container } from '@/lib/core/container'
import { logger } from '@/lib/logging/logger'

export interface ModulesConfig {
  sales?: {
    enableCircuitBreaker?: boolean
    enableCaching?: boolean
    maxRetries?: number
  }
  products?: {
    enableCircuitBreaker?: boolean
    enableCaching?: boolean
    maxRetries?: number
  }
  employees?: {
    enableCircuitBreaker?: boolean
    enableCaching?: boolean
    maxRetries?: number
  }
}

/**
 * Initialize all modules
 */
export async function initializeModules(config?: ModulesConfig): Promise<void> {
  try {
    logger.info('Initializing modules...')

    // Initialize Sales module
    SalesModule.forRoot(config?.sales)
    await SalesModule.initialize()

    // Initialize Products module
    ProductsModule.forRoot(config?.products)
    await ProductsModule.initialize()

    // Initialize Employees module
    EmployeesModule.forRoot(config?.employees)
    await EmployeesModule.initialize()

    logger.info('All modules initialized successfully')
  } catch (error) {
    logger.error('Failed to initialize modules', {
      error: error as Error,
      metadata: { module: 'main' }
    })
    throw error
  }
}

/**
 * Destroy all modules
 */
export async function destroyModules(): Promise<void> {
  try {
    logger.info('Destroying modules...')

    // Destroy modules in reverse order
    await EmployeesModule.destroy()
    await ProductsModule.destroy()
    await SalesModule.destroy()

    logger.info('All modules destroyed successfully')
  } catch (error) {
    logger.error('Failed to destroy modules', {
      error: error as Error,
      metadata: { module: 'main' }
    })
    throw error
  }
}

/**
 * Get service from container
 */
export function getService<T>(serviceName: string): T {
  return container.resolve<T>(serviceName)
}

// Export all modules
export { SalesModule } from './sales/sales.module'
export { ProductsModule } from './products/products.module'
export { EmployeesModule } from './employees/employees.module'

// Export service types
export type { SalesService } from './sales/sales.service'
export type { ProductsService } from './products/products.service'
export type { EmployeesService, MonthlyWorkSummary } from './employees/employees.service'

// Export error classes
export { SalesError } from './sales/sales.errors'
export { ProductsError } from './products/products.errors'
export { EmployeesError } from './employees/employees.errors'