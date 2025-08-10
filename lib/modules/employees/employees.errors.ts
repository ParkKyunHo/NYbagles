/**
 * Employees Module Errors
 * 직원 모듈 전용 에러 클래스
 */

import { BaseError } from '@/lib/errors/classes'
import { ErrorCode } from '@/lib/errors/types'

export class EmployeesError extends BaseError {
  constructor(
    code: ErrorCode,
    message: string,
    details?: any
  ) {
    super(code, message, details)
    this.name = 'EmployeesError'
  }

  /**
   * Employee not found
   */
  static notFound(id: string): EmployeesError {
    return new EmployeesError(
      ErrorCode.DB_003,
      `Employee with ID ${id} not found`,
      { employeeId: id }
    )
  }

  /**
   * Employee email not found
   */
  static emailNotFound(email: string): EmployeesError {
    return new EmployeesError(
      ErrorCode.DB_003,
      `Employee with email ${email} not found`,
      { email }
    )
  }

  /**
   * Duplicate email
   */
  static duplicateEmail(email: string): EmployeesError {
    return new EmployeesError(
      ErrorCode.VAL_004,
      `Employee with email ${email} already exists`,
      { email }
    )
  }

  /**
   * Employee creation failed
   */
  static createFailed(error: Error): EmployeesError {
    return new EmployeesError(
      ErrorCode.DB_002,
      `Failed to create employee: ${error.message}`,
      { originalError: error.message }
    )
  }

  /**
   * Employee fetch failed
   */
  static fetchFailed(error: Error): EmployeesError {
    return new EmployeesError(
      ErrorCode.DB_002,
      `Failed to fetch employees: ${error.message}`,
      { originalError: error.message }
    )
  }

  /**
   * Employee update failed
   */
  static updateFailed(error: Error): EmployeesError {
    return new EmployeesError(
      ErrorCode.DB_002,
      `Failed to update employee: ${error.message}`,
      { originalError: error.message }
    )
  }

  /**
   * Employee deactivation failed
   */
  static deactivateFailed(error: Error): EmployeesError {
    return new EmployeesError(
      ErrorCode.DB_002,
      `Failed to deactivate employee: ${error.message}`,
      { originalError: error.message }
    )
  }

  /**
   * Employee activation failed
   */
  static activateFailed(error: Error): EmployeesError {
    return new EmployeesError(
      ErrorCode.DB_002,
      `Failed to activate employee: ${error.message}`,
      { originalError: error.message }
    )
  }

  /**
   * Employee validation failed
   */
  static validationFailed(message: string): EmployeesError {
    return new EmployeesError(
      ErrorCode.VAL_002,
      message
    )
  }

  /**
   * Check-in failed
   */
  static checkInFailed(error: Error): EmployeesError {
    return new EmployeesError(
      ErrorCode.DB_002,
      `Failed to check in: ${error.message}`,
      { originalError: error.message }
    )
  }

  /**
   * Check-out failed
   */
  static checkOutFailed(error: Error): EmployeesError {
    return new EmployeesError(
      ErrorCode.DB_002,
      `Failed to check out: ${error.message}`,
      { originalError: error.message }
    )
  }

  /**
   * Already checked in
   */
  static alreadyCheckedIn(employeeId: string): EmployeesError {
    return new EmployeesError(
      ErrorCode.VAL_004,
      `Employee ${employeeId} is already checked in`,
      { employeeId }
    )
  }

  /**
   * Not checked in
   */
  static notCheckedIn(employeeId: string): EmployeesError {
    return new EmployeesError(
      ErrorCode.VAL_002,
      `Employee ${employeeId} is not checked in`,
      { employeeId }
    )
  }

  /**
   * Salary calculation failed
   */
  static salaryCalculationFailed(error: Error): EmployeesError {
    return new EmployeesError(
      ErrorCode.DB_002,
      `Failed to calculate salary: ${error.message}`,
      { originalError: error.message }
    )
  }

  /**
   * Unauthorized employee operation
   */
  static unauthorized(operation: string): EmployeesError {
    return new EmployeesError(
      ErrorCode.AUTH_003,
      `Unauthorized to perform ${operation} operation`,
      { operation }
    )
  }

  /**
   * Store not found
   */
  static storeNotFound(storeId: string): EmployeesError {
    return new EmployeesError(
      ErrorCode.DB_003,
      `Store ${storeId} not found`,
      { storeId }
    )
  }

  /**
   * Department not found
   */
  static departmentNotFound(department: string): EmployeesError {
    return new EmployeesError(
      ErrorCode.DB_003,
      `Department ${department} not found`,
      { department }
    )
  }

  /**
   * Invalid role
   */
  static invalidRole(role: string): EmployeesError {
    return new EmployeesError(
      ErrorCode.VAL_002,
      `Invalid role: ${role}`,
      { role }
    )
  }

  /**
   * Invalid hourly rate
   */
  static invalidHourlyRate(rate: number): EmployeesError {
    return new EmployeesError(
      ErrorCode.VAL_003,
      `Invalid hourly rate: ${rate}. Rate must be greater than 0`,
      { rate }
    )
  }

  /**
   * Auth user creation failed
   */
  static authUserFailed(error: Error): EmployeesError {
    return new EmployeesError(
      ErrorCode.AUTH_001,
      `Failed to create auth user: ${error.message}`,
      { originalError: error.message }
    )
  }

  /**
   * Profile creation failed
   */
  static profileFailed(error: Error): EmployeesError {
    return new EmployeesError(
      ErrorCode.DB_002,
      `Failed to create profile: ${error.message}`,
      { originalError: error.message }
    )
  }

  /**
   * Transaction rollback failed
   */
  static rollbackFailed(error: Error): EmployeesError {
    return new EmployeesError(
      ErrorCode.DB_004,
      `Failed to rollback transaction: ${error.message}`,
      { originalError: error.message }
    )
  }

  /**
   * Cross-store operation not allowed
   */
  static crossStoreOperation(employeeStore: string, userStore: string): EmployeesError {
    return new EmployeesError(
      ErrorCode.AUTH_003,
      `Cannot manage employee from store ${employeeStore} while managing store ${userStore}`,
      { employeeStore, userStore }
    )
  }
}