/**
 * Sales Module Errors
 * 판매 모듈 전용 에러 클래스
 */

import { BaseError } from '@/lib/errors/classes'
import { ErrorCode } from '@/lib/errors/types'

export class SalesError extends BaseError {
  constructor(
    code: ErrorCode,
    message: string,
    details?: any
  ) {
    super(code, message, details)
    this.name = 'SalesError'
  }

  /**
   * Sale not found
   */
  static notFound(id: string): SalesError {
    return new SalesError(
      ErrorCode.DB_003,
      `Sale with ID ${id} not found`,
      { saleId: id }
    )
  }

  /**
   * Sale creation failed
   */
  static createFailed(error: Error): SalesError {
    return new SalesError(
      ErrorCode.DB_002,
      `Failed to create sale: ${error.message}`,
      { originalError: error.message }
    )
  }

  /**
   * Sale fetch failed
   */
  static fetchFailed(error: Error): SalesError {
    return new SalesError(
      ErrorCode.DB_003,
      `Failed to fetch sales: ${error.message}`,
      { originalError: error.message }
    )
  }

  /**
   * Sale validation failed
   */
  static validationFailed(message: string): SalesError {
    return new SalesError(
      ErrorCode.VAL_002,
      message
    )
  }

  /**
   * Sale already cancelled
   */
  static alreadyCancelled(id: string): SalesError {
    return new SalesError(
      ErrorCode.VAL_002,
      `Sale ${id} is already cancelled`,
      { saleId: id }
    )
  }

  /**
   * Sale cancellation expired
   */
  static cancellationExpired(id: string): SalesError {
    return new SalesError(
      ErrorCode.API_004,
      `Sale ${id} cannot be cancelled after 24 hours`,
      { saleId: id }
    )
  }

  /**
   * Sale cancellation failed
   */
  static cancellationFailed(error: Error): SalesError {
    return new SalesError(
      ErrorCode.DB_002,
      `Failed to cancel sale: ${error.message}`,
      { originalError: error.message }
    )
  }

  /**
   * Insufficient stock
   */
  static insufficientStock(productId: string, available: number, requested: number): SalesError {
    return new SalesError(
      ErrorCode.VAL_003,
      `Insufficient stock for product ${productId}. Available: ${available}, Requested: ${requested}`,
      { productId, available, requested }
    )
  }

  /**
   * Payment processing failed
   */
  static paymentFailed(method: string, error: Error): SalesError {
    return new SalesError(
      ErrorCode.SYS_001,
      `Payment processing failed for ${method}: ${error.message}`,
      { paymentMethod: method, originalError: error.message }
    )
  }

  /**
   * Unauthorized sale operation
   */
  static unauthorized(operation: string): SalesError {
    return new SalesError(
      ErrorCode.AUTH_003,
      `Unauthorized to perform ${operation} operation`,
      { operation }
    )
  }

  /**
   * Store not found
   */
  static storeNotFound(storeId: string): SalesError {
    return new SalesError(
      ErrorCode.DB_003,
      `Store ${storeId} not found`,
      { storeId }
    )
  }

  /**
   * Product not found
   */
  static productNotFound(productId: string): SalesError {
    return new SalesError(
      ErrorCode.DB_003,
      `Product ${productId} not found`,
      { productId }
    )
  }
}