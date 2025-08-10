/**
 * Fallback Mechanism Implementation
 * 장애 시 대체 로직 구현
 */

import { FallbackConfig } from '../core/types'

export interface FallbackContext {
  error: Error
  attemptNumber: number
  elapsedTime: number
  metadata?: Record<string, any>
}

export interface FallbackOptions<T> extends FallbackConfig<T> {
  cache?: {
    enabled: boolean
    ttl?: number
    key?: (...args: any[]) => string
  }
  degraded?: {
    enabled: boolean
    service?: () => T | Promise<T>
  }
  default?: T
  onFallback?: (context: FallbackContext) => void
}

/**
 * Cache for fallback values
 */
class FallbackCache {
  private cache = new Map<string, { value: any; expiry: number }>()

  set(key: string, value: any, ttl: number): void {
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl
    })
  }

  get(key: string): any | undefined {
    const cached = this.cache.get(key)
    if (!cached) return undefined
    
    if (cached.expiry < Date.now()) {
      this.cache.delete(key)
      return undefined
    }
    
    return cached.value
  }

  clear(): void {
    this.cache.clear()
  }
}

const fallbackCache = new FallbackCache()

/**
 * Execute operation with fallback
 */
export async function withFallback<T>(
  operation: () => Promise<T>,
  options: FallbackOptions<T>
): Promise<T> {
  const startTime = Date.now()
  let attemptNumber = 0

  try {
    attemptNumber++
    
    // Try to execute operation with timeout
    if (options.timeout) {
      return await Promise.race([
        operation(),
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error('Operation timeout')), options.timeout)
        )
      ])
    }
    
    const result = await operation()
    
    // Cache successful result if caching is enabled
    if (options.cache?.enabled && options.cache.key) {
      const cacheKey = options.cache.key()
      const ttl = options.cache.ttl || 60000
      fallbackCache.set(cacheKey, result, ttl)
    }
    
    return result
  } catch (error) {
    const context: FallbackContext = {
      error: error as Error,
      attemptNumber,
      elapsedTime: Date.now() - startTime
    }
    
    // Notify fallback listener
    if (options.onFallback) {
      options.onFallback(context)
    }
    
    // Try cache first
    if (options.cache?.enabled && options.cache.key) {
      const cacheKey = options.cache.key()
      const cached = fallbackCache.get(cacheKey)
      if (cached !== undefined) {
        return cached
      }
    }
    
    // Try degraded service
    if (options.degraded?.enabled && options.degraded.service) {
      try {
        return await options.degraded.service()
      } catch (degradedError) {
        // Degraded service also failed
        context.error = degradedError as Error
      }
    }
    
    // Try fallback factory
    if (options.fallbackFactory) {
      try {
        return await options.fallbackFactory()
      } catch (fallbackError) {
        // Fallback factory also failed
        context.error = fallbackError as Error
      }
    }
    
    // Use fallback value
    if (options.fallbackValue !== undefined) {
      return options.fallbackValue
    }
    
    // Use default value
    if (options.default !== undefined) {
      return options.default
    }
    
    // Re-throw original error if no fallback available
    throw error
  }
}

/**
 * Fallback decorator for class methods
 */
export function Fallback<T>(options: FallbackOptions<T>) {
  return function(
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function(...args: any[]) {
      // Create cache key if caching is enabled
      const cacheOptions = options.cache?.enabled
        ? {
            ...options.cache,
            key: options.cache.key || (() => `${propertyKey}:${JSON.stringify(args)}`)
          }
        : undefined

      return withFallback(
        () => originalMethod.apply(this, args),
        {
          ...options,
          cache: cacheOptions
        }
      )
    }

    return descriptor
  }
}

/**
 * Create fallback chain
 */
export class FallbackChain<T> {
  private strategies: Array<() => Promise<T>> = []
  private options: {
    stopOnSuccess: boolean
    onError?: (error: Error, index: number) => void
  }

  constructor(options?: { stopOnSuccess?: boolean; onError?: (error: Error, index: number) => void }) {
    this.options = {
      stopOnSuccess: options?.stopOnSuccess !== false,
      onError: options?.onError
    }
  }

  /**
   * Add a fallback strategy
   */
  add(strategy: () => T | Promise<T>): this {
    this.strategies.push(async () => strategy())
    return this
  }

  /**
   * Add a cached fallback
   */
  addCached(
    strategy: () => T | Promise<T>,
    ttl = 60000,
    key?: string
  ): this {
    const cacheKey = key || `fallback-${this.strategies.length}`
    
    this.strategies.push(async () => {
      // Check cache first
      const cached = fallbackCache.get(cacheKey)
      if (cached !== undefined) {
        return cached
      }
      
      // Execute strategy and cache result
      const result = await strategy()
      fallbackCache.set(cacheKey, result, ttl)
      return result
    })
    
    return this
  }

  /**
   * Add a default value
   */
  addDefault(value: T): this {
    this.strategies.push(async () => value)
    return this
  }

  /**
   * Execute the fallback chain
   */
  async execute(): Promise<T> {
    const errors: Error[] = []
    
    for (let i = 0; i < this.strategies.length; i++) {
      try {
        const result = await this.strategies[i]()
        
        if (this.options.stopOnSuccess) {
          return result
        }
      } catch (error) {
        const err = error as Error
        errors.push(err)
        
        if (this.options.onError) {
          this.options.onError(err, i)
        }
        
        // Continue to next strategy
      }
    }
    
    // All strategies failed
    throw new AggregateError(errors, 'All fallback strategies failed')
  }
}

/**
 * Graceful degradation helper
 */
export class GracefulDegradation {
  private degradationLevels: Array<{
    name: string
    condition: () => boolean
    service: () => any
  }> = []

  /**
   * Add a degradation level
   */
  addLevel(
    name: string,
    condition: () => boolean,
    service: () => any
  ): this {
    this.degradationLevels.push({ name, condition, service })
    return this
  }

  /**
   * Get current degradation level
   */
  getCurrentLevel(): string | null {
    for (const level of this.degradationLevels) {
      if (level.condition()) {
        return level.name
      }
    }
    return null
  }

  /**
   * Execute with appropriate degradation
   */
  async execute<T>(primaryService: () => Promise<T>): Promise<T> {
    // Try primary service first
    try {
      return await primaryService()
    } catch (error) {
      // Find appropriate degradation level
      for (const level of this.degradationLevels) {
        if (level.condition()) {
          try {
            return await level.service()
          } catch (degradedError) {
            // Continue to next level
          }
        }
      }
      
      // No degradation available
      throw error
    }
  }
}

/**
 * Fallback presets
 */
export const FallbackStrategies = {
  // Return cached value or null
  cacheOrNull: <T>(): FallbackOptions<T | null> => ({
    cache: {
      enabled: true,
      ttl: 60000
    },
    default: null
  }),

  // Return cached value or empty array
  cacheOrEmpty: <T>(): FallbackOptions<T[]> => ({
    cache: {
      enabled: true,
      ttl: 60000
    },
    default: []
  }),

  // Return cached value or default object
  cacheOrDefault: <T>(defaultValue: T): FallbackOptions<T> => ({
    cache: {
      enabled: true,
      ttl: 60000
    },
    default: defaultValue
  }),

  // Use degraded service
  degradedService: <T>(service: () => T | Promise<T>): FallbackOptions<T> => ({
    degraded: {
      enabled: true,
      service
    }
  }),

  // No fallback (fail fast)
  none: <T>(): FallbackOptions<T> => ({})
}

/**
 * Create fallback configuration
 */
export function createFallback<T>(
  options: Partial<FallbackOptions<T>>
): FallbackOptions<T> {
  return {
    timeout: options.timeout || 10000,
    ...options
  }
}