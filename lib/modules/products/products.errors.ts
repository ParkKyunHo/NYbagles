/**
 * Products Module Errors
 * 상품 모듈 전용 에러 클래스
 */

import { BaseError } from '@/lib/errors/classes'
import { ErrorCode } from '@/lib/errors/types'

export class ProductsError extends BaseError {
  constructor(
    code: ErrorCode,
    message: string,
    details?: any
  ) {
    super(code, message, details)
    this.name = 'ProductsError'
  }

  /**
   * Product not found
   */
  static notFound(id: string): ProductsError {
    return new ProductsError(
      ErrorCode.DB_003,
      `Product with ID ${id} not found`,
      { productId: id }
    )
  }

  /**
   * Product SKU not found
   */
  static skuNotFound(sku: string): ProductsError {
    return new ProductsError(
      ErrorCode.DB_003,
      `Product with SKU ${sku} not found`,
      { sku }
    )
  }

  /**
   * Duplicate SKU
   */
  static duplicateSku(sku: string): ProductsError {
    return new ProductsError(
      ErrorCode.VAL_004,
      `Product with SKU ${sku} already exists`,
      { sku }
    )
  }

  /**
   * Product creation failed
   */
  static createFailed(error: Error): ProductsError {
    return new ProductsError(
      ErrorCode.DB_002,
      `Failed to create product: ${error.message}`,
      { originalError: error.message }
    )
  }

  /**
   * Product fetch failed
   */
  static fetchFailed(error: Error): ProductsError {
    return new ProductsError(
      ErrorCode.DB_003,
      `Failed to fetch products: ${error.message}`,
      { originalError: error.message }
    )
  }

  /**
   * Product update failed
   */
  static updateFailed(error: Error): ProductsError {
    return new ProductsError(
      ErrorCode.DB_002,
      `Failed to update product: ${error.message}`,
      { originalError: error.message }
    )
  }

  /**
   * Product delete failed
   */
  static deleteFailed(error: Error): ProductsError {
    return new ProductsError(
      ErrorCode.DB_002,
      `Failed to delete product: ${error.message}`,
      { originalError: error.message }
    )
  }

  /**
   * Product validation failed
   */
  static validationFailed(message: string): ProductsError {
    return new ProductsError(
      ErrorCode.VAL_002,
      message
    )
  }

  /**
   * Stock update failed
   */
  static stockUpdateFailed(error: Error): ProductsError {
    return new ProductsError(
      ErrorCode.DB_002,
      `Failed to update stock: ${error.message}`,
      { originalError: error.message }
    )
  }

  /**
   * Insufficient stock
   */
  static insufficientStock(productId: string, available: number, requested: number): ProductsError {
    return new ProductsError(
      ErrorCode.VAL_003,
      `Insufficient stock for product ${productId}. Available: ${available}, Requested: ${requested}`,
      { productId, available, requested }
    )
  }

  /**
   * Product change request failed
   */
  static changeRequestFailed(error: Error): ProductsError {
    return new ProductsError(
      ErrorCode.DB_002,
      `Failed to create change request: ${error.message}`,
      { originalError: error.message }
    )
  }

  /**
   * Product approval failed
   */
  static approvalFailed(error: Error): ProductsError {
    return new ProductsError(
      ErrorCode.DB_002,
      `Failed to approve change: ${error.message}`,
      { originalError: error.message }
    )
  }

  /**
   * Product rejection failed
   */
  static rejectionFailed(error: Error): ProductsError {
    return new ProductsError(
      ErrorCode.DB_002,
      `Failed to reject change: ${error.message}`,
      { originalError: error.message }
    )
  }

  /**
   * Unauthorized product operation
   */
  static unauthorized(operation: string): ProductsError {
    return new ProductsError(
      ErrorCode.AUTH_003,
      `Unauthorized to perform ${operation} operation`,
      { operation }
    )
  }

  /**
   * Store not found
   */
  static storeNotFound(storeId: string): ProductsError {
    return new ProductsError(
      ErrorCode.DB_003,
      `Store ${storeId} not found`,
      { storeId }
    )
  }

  /**
   * Category not found
   */
  static categoryNotFound(category: string): ProductsError {
    return new ProductsError(
      ErrorCode.DB_003,
      `Category ${category} not found`,
      { category }
    )
  }

  /**
   * Product has active sales
   */
  static hasActiveSales(productId: string): ProductsError {
    return new ProductsError(
      ErrorCode.VAL_003,
      `Cannot delete product ${productId} with active sales`,
      { productId }
    )
  }

  /**
   * Invalid price
   */
  static invalidPrice(price: number): ProductsError {
    return new ProductsError(
      ErrorCode.VAL_002,
      `Invalid price: ${price}. Price must be greater than 0`,
      { price }
    )
  }

  /**
   * Invalid cost
   */
  static invalidCost(cost: number): ProductsError {
    return new ProductsError(
      ErrorCode.VAL_002,
      `Invalid cost: ${cost}. Cost must be greater than or equal to 0`,
      { cost }
    )
  }
}