/**
 * Employees Service
 * 직원 비즈니스 로직 - Circuit Breaker와 Fallback 적용
 */

import { Injectable, Inject, Log, Retry, Timeout, Cacheable } from '@/lib/core/decorators'
import { ServiceScope, CircuitState } from '@/lib/core/types'
import { 
  EmployeesRepository, 
  Employee, 
  EmployeeFilter, 
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  AttendanceRecord,
  SalaryCalculation,
  EmployeeStats
} from './employees.repository'
import { CircuitBreaker, CircuitBreakerFactory } from '@/lib/resilience/circuit-breaker'
import { withFallback, FallbackChain } from '@/lib/resilience/fallback'
import { withRetry, RetryPolicies } from '@/lib/resilience/retry-policy'
import { EmployeesError } from './employees.errors'
import { logger } from '@/lib/logging/logger'

export interface EmployeesServiceConfig {
  enableCircuitBreaker?: boolean
  enableCaching?: boolean
  maxRetries?: number
  timeout?: number
}

export interface MonthlyWorkSummary {
  employeeId: string
  employeeName: string
  totalDays: number
  totalHours: number
  regularHours: number
  overtimeHours: number
  estimatedPay: number
}

@Injectable({ scope: ServiceScope.SINGLETON })
export class EmployeesService {
  private circuitBreaker: CircuitBreaker
  private config: Required<EmployeesServiceConfig>
  private repository: EmployeesRepository

  constructor() {
    // Initialize repository directly
    this.repository = new EmployeesRepository()
    this.config = {
      enableCircuitBreaker: true,
      enableCaching: true,
      maxRetries: 3,
      timeout: 10000
    }

    // Initialize circuit breaker
    this.circuitBreaker = CircuitBreakerFactory.create({
      name: 'employees-service',
      timeout: this.config.timeout,
      errorThresholdPercentage: 50,
      requestVolumeThreshold: 10,
      sleepWindowMs: 30000
    })

    // Subscribe to circuit breaker events
    this.setupCircuitBreakerMonitoring()
  }

  /**
   * Get employees with fallback to cached data
   */
  async getEmployees(filter: EmployeeFilter): Promise<{
    data: Employee[]
    total: number
  }> {
    const fallbackChain = new FallbackChain<{ data: Employee[]; total: number }>()
      .addCached(
        () => this.repository.getEmployees(filter),
        300000, // 5 minutes cache
        `employees-${JSON.stringify(filter)}`
      )
      .addDefault({
        data: [],
        total: 0
      })

    try {
      return await this.circuitBreaker.execute(() => fallbackChain.execute())
    } catch (error) {
      logger.error('Failed to get employees', {
        error: error as Error,
        metadata: { service: 'employees', operation: 'list' }
      })
      
      // Return empty result as last resort
      return {
        data: [],
        total: 0
      }
    }
  }

  /**
   * Get single employee by ID
   */
  async getEmployeeById(id: string): Promise<Employee> {
    try {
      const employee = await this.circuitBreaker.execute(
        () => this.repository.getEmployeeById(id)
      )

      if (!employee) {
        throw EmployeesError.notFound(id)
      }

      return employee
    } catch (error) {
      if (error instanceof EmployeesError) {
        throw error
      }
      
      logger.error('Failed to get employee by ID', {
        error: error as Error,
        metadata: { service: 'employees', operation: 'getById' }
      })
      
      throw EmployeesError.fetchFailed(error as Error)
    }
  }

  /**
   * Get employee by email
   */
  async getEmployeeByEmail(email: string): Promise<Employee> {
    try {
      const employee = await this.circuitBreaker.execute(
        () => this.repository.getEmployeeByEmail(email)
      )

      if (!employee) {
        throw EmployeesError.emailNotFound(email)
      }

      return employee
    } catch (error) {
      if (error instanceof EmployeesError) {
        throw error
      }
      
      logger.error('Failed to get employee by email', {
        error: error as Error,
        metadata: { service: 'employees', operation: 'getByEmail' }
      })
      
      throw EmployeesError.fetchFailed(error as Error)
    }
  }

  /**
   * Create a new employee with validation
   */
  async createEmployee(data: CreateEmployeeRequest, userId: string): Promise<Employee> {
    // Validate input
    this.validateEmployeeData(data)

    try {
      // Check for duplicate email
      const existing = await this.repository.getEmployeeByEmail(data.email)
      if (existing) {
        throw EmployeesError.duplicateEmail(data.email)
      }

      // Create employee with retry policy
      return await withRetry(
        () => this.circuitBreaker.execute(
          () => this.repository.createEmployee(data)
        ),
        RetryPolicies.standard()
      )
    } catch (error) {
      if (error instanceof EmployeesError) {
        throw error
      }
      
      logger.error('Failed to create employee', {
        error: error as Error,
        metadata: { service: 'employees', operation: 'create' }
      })
      
      throw EmployeesError.createFailed(error as Error)
    }
  }

  /**
   * Update an employee with validation
   */
  async updateEmployee(
    id: string,
    data: UpdateEmployeeRequest,
    userId: string
  ): Promise<Employee> {
    // Validate update data
    if (data.hourly_rate !== undefined && data.hourly_rate < 0) {
      throw EmployeesError.validationFailed('Hourly rate cannot be negative')
    }

    try {
      // Check if employee exists
      const existing = await this.getEmployeeById(id)
      
      if (!existing) {
        throw EmployeesError.notFound(id)
      }

      // Update employee
      return await this.circuitBreaker.execute(
        () => this.repository.updateEmployee(id, data)
      )
    } catch (error) {
      if (error instanceof EmployeesError) {
        throw error
      }
      
      logger.error('Failed to update employee', {
        error: error as Error,
        metadata: { service: 'employees', operation: 'update' }
      })
      
      throw EmployeesError.updateFailed(error as Error)
    }
  }

  /**
   * Deactivate an employee
   */
  async deactivateEmployee(id: string, userId: string): Promise<boolean> {
    try {
      // Check if employee exists
      const employee = await this.getEmployeeById(id)
      
      if (!employee) {
        throw EmployeesError.notFound(id)
      }

      // Deactivate employee
      return await this.circuitBreaker.execute(
        () => this.repository.deactivateEmployee(id)
      )
    } catch (error) {
      if (error instanceof EmployeesError) {
        throw error
      }
      
      logger.error('Failed to deactivate employee', {
        error: error as Error,
        metadata: { service: 'employees', operation: 'deactivate' }
      })
      
      throw EmployeesError.deactivateFailed(error as Error)
    }
  }

  /**
   * Activate an employee
   */
  async activateEmployee(id: string, userId: string): Promise<boolean> {
    try {
      // Check if employee exists
      const employee = await this.getEmployeeById(id)
      
      if (!employee) {
        throw EmployeesError.notFound(id)
      }

      // Activate employee
      return await this.circuitBreaker.execute(
        () => this.repository.activateEmployee(id)
      )
    } catch (error) {
      if (error instanceof EmployeesError) {
        throw error
      }
      
      logger.error('Failed to activate employee', {
        error: error as Error,
        metadata: { service: 'employees', operation: 'activate' }
      })
      
      throw EmployeesError.activateFailed(error as Error)
    }
  }

  /**
   * Check in employee
   */
  async checkIn(employeeId: string): Promise<AttendanceRecord> {
    try {
      // Verify employee exists and is active
      const employee = await this.getEmployeeById(employeeId)
      
      if (!employee) {
        throw EmployeesError.notFound(employeeId)
      }

      if (!employee.is_active) {
        throw EmployeesError.validationFailed('Employee is not active')
      }

      // Check in
      return await this.circuitBreaker.execute(
        () => this.repository.checkIn(employeeId)
      )
    } catch (error) {
      if (error instanceof EmployeesError) {
        throw error
      }
      
      // Check for specific error message
      if ((error as Error).message === 'Employee is already checked in') {
        throw EmployeesError.alreadyCheckedIn(employeeId)
      }
      
      logger.error('Failed to check in employee', {
        error: error as Error,
        metadata: { service: 'employees', operation: 'checkIn' }
      })
      
      throw EmployeesError.checkInFailed(error as Error)
    }
  }

  /**
   * Check out employee
   */
  async checkOut(employeeId: string): Promise<AttendanceRecord> {
    try {
      // Verify employee exists
      const employee = await this.getEmployeeById(employeeId)
      
      if (!employee) {
        throw EmployeesError.notFound(employeeId)
      }

      // Check out
      return await this.circuitBreaker.execute(
        () => this.repository.checkOut(employeeId)
      )
    } catch (error) {
      if (error instanceof EmployeesError) {
        throw error
      }
      
      // Check for specific error message
      if ((error as Error).message === 'No active check-in found') {
        throw EmployeesError.notCheckedIn(employeeId)
      }
      
      logger.error('Failed to check out employee', {
        error: error as Error,
        metadata: { service: 'employees', operation: 'checkOut' }
      })
      
      throw EmployeesError.checkOutFailed(error as Error)
    }
  }

  /**
   * Get attendance records
   */
  async getAttendanceRecords(
    employeeId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<AttendanceRecord[]> {
    try {
      return await withFallback(
        () => this.circuitBreaker.execute(
          () => this.repository.getAttendanceRecords(employeeId, startDate, endDate)
        ),
        {
          cache: {
            enabled: true,
            ttl: 60000, // 1 minute (real-time data)
            key: () => `attendance-${employeeId}-${startDate}-${endDate}`
          },
          default: []
        }
      )
    } catch (error) {
      logger.error('Failed to get attendance records', {
        error: error as Error,
        metadata: { service: 'employees', operation: 'getAttendance' }
      })
      
      return []
    }
  }

  /**
   * Calculate salary for employee
   */
  async calculateSalary(
    employeeId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<SalaryCalculation> {
    try {
      // Verify employee exists
      const employee = await this.getEmployeeById(employeeId)
      
      if (!employee) {
        throw EmployeesError.notFound(employeeId)
      }

      // Calculate salary
      return await this.circuitBreaker.execute(
        () => this.repository.calculateSalary(employeeId, periodStart, periodEnd)
      )
    } catch (error) {
      if (error instanceof EmployeesError) {
        throw error
      }
      
      logger.error('Failed to calculate salary', {
        error: error as Error,
        metadata: { service: 'employees', operation: 'calculateSalary' }
      })
      
      throw EmployeesError.salaryCalculationFailed(error as Error)
    }
  }

  /**
   * Get salary calculations
   */
  async getSalaryCalculations(
    employeeId?: string,
    status?: string
  ): Promise<SalaryCalculation[]> {
    try {
      return await withFallback(
        () => this.circuitBreaker.execute(
          () => this.repository.getSalaryCalculations(employeeId, status)
        ),
        {
          cache: {
            enabled: true,
            ttl: 300000, // 5 minutes
            key: () => `salary-calculations-${employeeId}-${status}`
          },
          default: []
        }
      )
    } catch (error) {
      logger.error('Failed to get salary calculations', {
        error: error as Error,
        metadata: { service: 'employees', operation: 'getSalaryCalculations' }
      })
      
      return []
    }
  }

  /**
   * Get employee statistics
   */
  async getEmployeeStats(storeId?: string): Promise<EmployeeStats> {
    try {
      return await this.circuitBreaker.execute(
        () => this.repository.getEmployeeStats(storeId)
      )
    } catch (error) {
      logger.error('Failed to get employee stats', {
        error: error as Error,
        metadata: { service: 'employees', operation: 'stats' }
      })
      
      // Return default stats
      return {
        total: 0,
        active: 0,
        inactive: 0,
        byRole: {},
        byDepartment: {},
        avgHourlyRate: 0
      }
    }
  }

  /**
   * Get departments
   */
  async getDepartments(storeId?: string): Promise<string[]> {
    try {
      return await this.circuitBreaker.execute(
        () => this.repository.getDepartments(storeId)
      )
    } catch (error) {
      logger.error('Failed to get departments', {
        error: error as Error,
        metadata: { service: 'employees', operation: 'getDepartments' }
      })
      
      return []
    }
  }

  /**
   * Get monthly work summary for employees
   */
  async getMonthlyWorkSummary(
    storeId?: string,
    month?: string
  ): Promise<MonthlyWorkSummary[]> {
    try {
      // Calculate date range for the month
      const now = month ? new Date(month) : new Date()
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()

      // Get employees
      const employees = await this.getEmployees({ storeId, isActive: true })

      // Get attendance records for all employees
      const summaries: MonthlyWorkSummary[] = []

      for (const employee of employees.data) {
        const attendance = await this.getAttendanceRecords(
          employee.id,
          startDate,
          endDate
        )

        let totalHours = 0
        let regularHours = 0
        let overtimeHours = 0
        const workDays = new Set<string>()

        attendance.forEach(record => {
          if (record.hours_worked) {
            totalHours += record.hours_worked
            regularHours += Math.min(record.hours_worked, 8)
            overtimeHours += record.overtime_hours || 0
            
            // Count unique work days
            const day = new Date(record.check_in).toISOString().split('T')[0]
            workDays.add(day)
          }
        })

        const regularPay = regularHours * employee.hourly_rate
        const overtimePay = overtimeHours * employee.hourly_rate * 1.5
        const estimatedPay = regularPay + overtimePay

        summaries.push({
          employeeId: employee.id,
          employeeName: employee.name,
          totalDays: workDays.size,
          totalHours,
          regularHours,
          overtimeHours,
          estimatedPay
        })
      }

      return summaries
    } catch (error) {
      logger.error('Failed to get monthly work summary', {
        error: error as Error,
        metadata: { service: 'employees', operation: 'monthlyWorkSummary' }
      })
      
      return []
    }
  }

  /**
   * Validate employee data
   */
  private validateEmployeeData(data: CreateEmployeeRequest): void {
    if (!data.email || !data.email.includes('@')) {
      throw EmployeesError.validationFailed('Invalid email address')
    }

    if (!data.name || data.name.trim().length < 2) {
      throw EmployeesError.validationFailed('Name must be at least 2 characters')
    }

    if (data.hourly_rate < 0) {
      throw EmployeesError.invalidHourlyRate(data.hourly_rate)
    }

    const validRoles = ['super_admin', 'admin', 'manager', 'employee', 'part_time']
    if (!validRoles.includes(data.role)) {
      throw EmployeesError.invalidRole(data.role)
    }

    if (!data.store_id) {
      throw EmployeesError.validationFailed('Store ID is required')
    }
  }

  /**
   * Setup circuit breaker monitoring
   */
  private setupCircuitBreakerMonitoring(): void {
    this.circuitBreaker.on('stateChange', ({ from, to }) => {
      logger.warn('Employees service circuit breaker state changed', {
        metadata: { service: 'employees', component: 'circuit-breaker', from, to }
      })
    })

    this.circuitBreaker.on('failure', ({ error }) => {
      logger.error('Employees service operation failed', {
        error: error as Error,
        metadata: { service: 'employees', component: 'circuit-breaker' }
      })
    })

    this.circuitBreaker.on('timeout', () => {
      logger.warn('Employees service operation timed out', {
        metadata: { service: 'employees', component: 'circuit-breaker' }
      })
    })

    this.circuitBreaker.on('retry', ({ attempt, error }) => {
      logger.info('Employees service retrying operation', {
        error: error as Error,
        metadata: { service: 'employees', component: 'circuit-breaker', attempt }
      })
    })
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details?: any }> {
    try {
      const repoHealth = await this.repository.healthCheck()
      const circuitBreakerState = this.circuitBreaker.getState()

      return {
        status: repoHealth.status === 'healthy' && circuitBreakerState !== CircuitState.OPEN 
          ? 'healthy' 
          : 'unhealthy',
        details: {
          repository: repoHealth,
          circuitBreaker: {
            state: circuitBreakerState,
            stats: this.circuitBreaker.getStats()
          }
        }
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: (error as Error).message }
      }
    }
  }
}