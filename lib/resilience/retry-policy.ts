/**
 * Retry Policy Implementation
 * 재시도 정책 구현 - 일시적 장애 복구
 */

import { RetryPolicy } from '../core/types'

export interface RetryContext {
  attempt: number
  error: Error
  startTime: number
  elapsedTime: number
}

export interface RetryOptions extends RetryPolicy {
  onRetry?: (context: RetryContext) => void
  shouldRetry?: (error: Error, attempt: number) => boolean
  timeout?: number
  abortSignal?: AbortSignal
}

export class RetryError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly errors: Error[]
  ) {
    super(message)
    this.name = 'RetryError'
  }
}

/**
 * Execute operation with retry policy
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const {
    maxAttempts = 3,
    delay = 1000,
    maxDelay = 30000,
    backoff = 'exponential',
    retryOn,
    onRetry,
    shouldRetry,
    timeout,
    abortSignal
  } = options

  const errors: Error[] = []
  const startTime = Date.now()

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Check abort signal
    if (abortSignal?.aborted) {
      throw new Error('Operation aborted')
    }

    try {
      // Execute with timeout if specified
      if (timeout) {
        return await withTimeout(operation(), timeout)
      }
      return await operation()
    } catch (error) {
      const err = error as Error
      errors.push(err)

      // Check if we should retry
      const shouldContinue = shouldRetry 
        ? shouldRetry(err, attempt)
        : retryOn 
          ? retryOn(err)
          : isRetryableError(err)

      if (!shouldContinue || attempt === maxAttempts) {
        throw new RetryError(
          `Operation failed after ${attempt} attempts: ${err.message}`,
          attempt,
          errors
        )
      }

      // Calculate delay
      const currentDelay = calculateDelay(attempt, delay, maxDelay, backoff)
      
      // Notify retry listener
      if (onRetry) {
        onRetry({
          attempt,
          error: err,
          startTime,
          elapsedTime: Date.now() - startTime
        })
      }

      // Wait before next attempt
      await sleep(currentDelay)
    }
  }

  // Should never reach here
  throw new RetryError(
    'Max attempts reached',
    maxAttempts,
    errors
  )
}

/**
 * Execute operation with linear retry
 */
export async function linearRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = 3,
  delay = 1000
): Promise<T> {
  return withRetry(operation, {
    maxAttempts,
    delay,
    backoff: 'linear'
  })
}

/**
 * Execute operation with exponential backoff
 */
export async function exponentialRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = 3,
  initialDelay = 1000,
  maxDelay = 30000
): Promise<T> {
  return withRetry(operation, {
    maxAttempts,
    delay: initialDelay,
    maxDelay,
    backoff: 'exponential'
  })
}

/**
 * Execute operation with custom retry condition
 */
export async function conditionalRetry<T>(
  operation: () => Promise<T>,
  condition: (error: Error) => boolean,
  options?: Partial<RetryOptions>
): Promise<T> {
  return withRetry(operation, {
    delay: 1000,
    ...options,
    retryOn: condition,
    maxAttempts: options?.maxAttempts || 3
  })
}

/**
 * Retry decorator for class methods
 */
export function Retry(options: Partial<RetryOptions> = {}) {
  return function(
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function(...args: any[]) {
      return withRetry(
        () => originalMethod.apply(this, args),
        {
          maxAttempts: 3,
          delay: 1000,
          ...options
        }
      )
    }

    return descriptor
  }
}

/**
 * Calculate delay based on backoff strategy
 */
function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  backoff: 'linear' | 'exponential'
): number {
  let delay: number

  if (backoff === 'exponential') {
    // Exponential backoff with jitter
    delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay)
    // Add jitter (0-25% of delay)
    delay += delay * Math.random() * 0.25
  } else {
    // Linear backoff
    delay = Math.min(baseDelay * attempt, maxDelay)
  }

  return Math.floor(delay)
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: Error): boolean {
  // Network errors
  if (error.message.includes('ECONNREFUSED')) return true
  if (error.message.includes('ETIMEDOUT')) return true
  if (error.message.includes('ENOTFOUND')) return true
  if (error.message.includes('ENETUNREACH')) return true
  
  // HTTP errors
  if ('status' in error) {
    const status = (error as any).status
    // Retry on 5xx errors and specific 4xx errors
    return status >= 500 || status === 429 || status === 408
  }
  
  // Database errors
  if (error.message.includes('connection')) return true
  if (error.message.includes('timeout')) return true
  
  return false
}

/**
 * Execute operation with timeout
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
    )
  ])
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry policy presets
 */
export const RetryPolicies = {
  // No retry
  none: (): RetryOptions => ({
    maxAttempts: 1,
    delay: 0
  }),

  // Quick retry for fast operations
  quick: (): RetryOptions => ({
    maxAttempts: 3,
    delay: 100,
    maxDelay: 1000,
    backoff: 'exponential'
  }),

  // Standard retry for most operations
  standard: (): RetryOptions => ({
    maxAttempts: 3,
    delay: 1000,
    maxDelay: 10000,
    backoff: 'exponential'
  }),

  // Aggressive retry for critical operations
  aggressive: (): RetryOptions => ({
    maxAttempts: 5,
    delay: 1000,
    maxDelay: 30000,
    backoff: 'exponential'
  }),

  // Database operations
  database: (): RetryOptions => ({
    maxAttempts: 3,
    delay: 500,
    maxDelay: 5000,
    backoff: 'exponential',
    retryOn: (error) => isRetryableError(error) && error.message.includes('database')
  }),

  // Network operations
  network: (): RetryOptions => ({
    maxAttempts: 4,
    delay: 1000,
    maxDelay: 15000,
    backoff: 'exponential',
    retryOn: (error) => isRetryableError(error)
  }),

  // Rate limited operations
  rateLimited: (): RetryOptions => ({
    maxAttempts: 5,
    delay: 2000,
    maxDelay: 60000,
    backoff: 'exponential',
    retryOn: (error) => {
      if ('status' in error) {
        return (error as any).status === 429
      }
      return error.message.includes('rate limit')
    }
  })
}

/**
 * Create custom retry policy
 */
export function createRetryPolicy(
  options: Partial<RetryOptions>
): RetryOptions {
  return {
    maxAttempts: options.maxAttempts || 3,
    delay: options.delay || 1000,
    maxDelay: options.maxDelay || 30000,
    backoff: options.backoff || 'exponential',
    ...options
  }
}