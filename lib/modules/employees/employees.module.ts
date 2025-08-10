/**
 * Employees Module
 * 직원 모듈 - 의존성 주입 설정 및 모듈 구성
 */

import { Module } from '@/lib/core/decorators'
import { ServiceProvider } from '@/lib/core/types'
import { EmployeesRepository } from './employees.repository'
import { EmployeesService } from './employees.service'
import { container } from '@/lib/core/container'

// Module providers
const providers: ServiceProvider[] = [
  {
    provide: 'EmployeesRepository',
    useClass: EmployeesRepository
  },
  {
    provide: 'EmployeesService',
    useClass: EmployeesService,
    deps: ['EmployeesRepository']
  }
]

// Module exports
const exports = ['EmployeesService']

/**
 * Employees Module Configuration
 */
@Module({
  providers,
  exports
})
export class EmployeesModule {
  static forRoot(config?: {
    enableCircuitBreaker?: boolean
    enableCaching?: boolean
    maxRetries?: number
  }) {
    // Register module with configuration
    container.registerModule('EmployeesModule', providers, [], exports)
    
    // Apply configuration if provided
    if (config) {
      container.register({
        provide: 'EmployeesConfig',
        useValue: config
      })
    }

    return EmployeesModule
  }

  /**
   * Initialize module
   */
  static async initialize(): Promise<void> {
    const service = container.resolve<EmployeesService>('EmployeesService')
    
    // Perform health check
    const health = await service.healthCheck()
    
    if (health.status === 'unhealthy') {
      console.warn('Employees module initialized with warnings:', health.details)
    } else {
      console.log('Employees module initialized successfully')
    }
  }

  /**
   * Destroy module
   */
  static async destroy(): Promise<void> {
    // Clean up resources if needed
    console.log('Employees module destroyed')
  }
}

// Export service interfaces
export { EmployeesService } from './employees.service'
export { EmployeesRepository } from './employees.repository'
export { EmployeesError } from './employees.errors'
export type { 
  Employee,
  EmployeeFilter,
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  AttendanceRecord,
  SalaryCalculation,
  EmployeeStats
} from './employees.repository'

export type {
  MonthlyWorkSummary
} from './employees.service'