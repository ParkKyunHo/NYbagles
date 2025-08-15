/**
 * Cache Manager for Performance Optimization
 * Implements a multi-layer caching strategy with TTL support
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

class CacheManager {
  private memoryCache: Map<string, CacheEntry<any>> = new Map()
  private readonly DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes
  private readonly MAX_CACHE_SIZE = 100
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Start periodic cleanup
    this.startCleanup()
  }

  /**
   * Get data from cache
   */
  get<T>(key: string): T | null {
    const entry = this.memoryCache.get(key)
    
    if (!entry) {
      return null
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.memoryCache.delete(key)
      return null
    }

    return entry.data
  }

  /**
   * Set data in cache
   */
  set<T>(key: string, data: T, ttl?: number): void {
    // Implement LRU if cache is full
    if (this.memoryCache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.memoryCache.keys().next().value
      this.memoryCache.delete(firstKey)
    }

    this.memoryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.DEFAULT_TTL
    })
  }

  /**
   * Delete specific cache entry
   */
  delete(key: string): boolean {
    return this.memoryCache.delete(key)
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.memoryCache.clear()
  }

  /**
   * Clear cache entries matching a pattern
   */
  clearPattern(pattern: string): void {
    const regex = new RegExp(pattern)
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key)
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.memoryCache.size,
      maxSize: this.MAX_CACHE_SIZE,
      keys: Array.from(this.memoryCache.keys())
    }
  }

  /**
   * Periodic cleanup of expired entries
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of this.memoryCache.entries()) {
        if (now - entry.timestamp > entry.ttl) {
          this.memoryCache.delete(key)
        }
      }
    }, 60 * 1000) // Run every minute
  }

  /**
   * Stop cleanup interval (for cleanup)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
  }
}

// Singleton instance
let cacheInstance: CacheManager | null = null

export function getCacheManager(): CacheManager {
  if (!cacheInstance) {
    cacheInstance = new CacheManager()
  }
  return cacheInstance
}

/**
 * Cache decorator for async functions
 */
export function cacheable<T extends (...args: any[]) => Promise<any>>(
  keyGenerator: (...args: Parameters<T>) => string,
  ttl?: number
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: Parameters<T>) {
      const cache = getCacheManager()
      const cacheKey = keyGenerator(...args)
      
      // Check cache first
      const cached = cache.get(cacheKey)
      if (cached !== null) {
        console.log(`[Cache Hit] ${propertyKey} - ${cacheKey}`)
        return cached
      }

      // Execute original method
      console.log(`[Cache Miss] ${propertyKey} - ${cacheKey}`)
      const result = await originalMethod.apply(this, args)
      
      // Store in cache
      cache.set(cacheKey, result, ttl)
      
      return result
    }

    return descriptor
  }
}

/**
 * React Query integration
 */
export function getCacheKey(prefix: string, params: Record<string, any>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      if (params[key] !== undefined && params[key] !== null) {
        acc[key] = params[key]
      }
      return acc
    }, {} as Record<string, any>)
  
  return `${prefix}:${JSON.stringify(sortedParams)}`
}

/**
 * Invalidate related caches
 */
export function invalidateRelatedCaches(patterns: string[]): void {
  const cache = getCacheManager()
  patterns.forEach(pattern => cache.clearPattern(pattern))
}