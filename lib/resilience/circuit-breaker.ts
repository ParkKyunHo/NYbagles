/**
 * Circuit Breaker Pattern Implementation
 * 장애 격리 및 자동 복구를 위한 Circuit Breaker 패턴
 */

import { CircuitState, RetryPolicy, FallbackConfig } from '../core/types'
import { EventEmitter } from 'events'

export interface CircuitBreakerOptions {
  name: string
  timeout?: number                    // 작업 타임아웃 (ms)
  errorThreshold?: number            // 에러 임계값 (0-1)
  errorThresholdPercentage?: number  // 에러 비율 임계값 (0-100)
  requestVolumeThreshold?: number    // 최소 요청 수
  sleepWindowMs?: number              // Open 상태 유지 시간
  bucketSize?: number                 // 통계 버킷 크기
  bucketNum?: number                  // 버킷 개수
  fallback?: <T>() => T | Promise<T>
  healthCheck?: () => Promise<boolean>
  retryPolicy?: RetryPolicy
}

export interface CircuitBreakerStats {
  state: CircuitState
  metrics: {
    requestCount: number
    errorCount: number
    successCount: number
    timeoutCount: number
    errorPercentage: number
    avgResponseTime: number
  }
  lastError?: Error
  lastStateChange: Date
  nextAttempt?: Date
}

class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly state: CircuitState,
    public readonly originalError?: Error
  ) {
    super(message)
    this.name = 'CircuitBreakerError'
  }
}

export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED
  private options: Required<CircuitBreakerOptions>
  private stats: CircuitBreakerStats
  private requestBuckets: Array<{
    timestamp: number
    success: number
    failure: number
    timeout: number
    responseTime: number[]
  }> = []
  private halfOpenRequests = 0
  private maxHalfOpenRequests = 1
  private lastStateChangeTime = Date.now()
  private nextAttemptTime?: number

  constructor(options: CircuitBreakerOptions) {
    super()
    
    this.options = {
      name: options.name,
      timeout: options.timeout || 10000,
      errorThreshold: options.errorThreshold || 0.5,
      errorThresholdPercentage: options.errorThresholdPercentage || 50,
      requestVolumeThreshold: options.requestVolumeThreshold || 20,
      sleepWindowMs: options.sleepWindowMs || 60000,
      bucketSize: options.bucketSize || 1000,
      bucketNum: options.bucketNum || 10,
      fallback: options.fallback || (() => { throw new Error('No fallback provided') }),
      healthCheck: options.healthCheck || (() => Promise.resolve(true)),
      retryPolicy: options.retryPolicy || {
        maxAttempts: 0,
        delay: 0
      }
    }

    this.stats = {
      state: this.state,
      metrics: {
        requestCount: 0,
        errorCount: 0,
        successCount: 0,
        timeoutCount: 0,
        errorPercentage: 0,
        avgResponseTime: 0
      },
      lastStateChange: new Date()
    }

    // Initialize buckets
    this.initializeBuckets()
    
    // Start bucket rotation
    this.startBucketRotation()
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    operation: () => Promise<T>,
    fallbackOverride?: () => T | Promise<T>
  ): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.transitionTo(CircuitState.HALF_OPEN)
      } else {
        return this.handleOpen(fallbackOverride)
      }
    }

    // Check if half-open and limit concurrent requests
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.halfOpenRequests >= this.maxHalfOpenRequests) {
        return this.handleOpen(fallbackOverride)
      }
      this.halfOpenRequests++
    }

    const startTime = Date.now()
    
    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(operation)
      
      // Record success
      this.recordSuccess(Date.now() - startTime)
      
      // Handle state transitions
      if (this.state === CircuitState.HALF_OPEN) {
        this.halfOpenRequests--
        this.transitionTo(CircuitState.CLOSED)
      }
      
      return result
    } catch (error) {
      // Record failure
      this.recordFailure(error as Error, Date.now() - startTime)
      
      // Handle state transitions
      if (this.state === CircuitState.HALF_OPEN) {
        this.halfOpenRequests--
        this.transitionTo(CircuitState.OPEN)
      } else if (this.shouldTrip()) {
        this.transitionTo(CircuitState.OPEN)
      }
      
      // Try fallback
      if (fallbackOverride) {
        return fallbackOverride()
      } else if (this.options.fallback) {
        return this.options.fallback()
      }
      
      throw error
    }
  }

  /**
   * Execute with retry policy
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    retryPolicy?: RetryPolicy
  ): Promise<T> {
    const policy = retryPolicy || this.options.retryPolicy
    let lastError: Error

    for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
      try {
        return await this.execute(operation)
      } catch (error) {
        lastError = error as Error
        
        // Check if we should retry
        if (policy.retryOn && !policy.retryOn(lastError)) {
          throw lastError
        }
        
        if (attempt < policy.maxAttempts) {
          // Calculate delay
          const delay = policy.backoff === 'exponential'
            ? Math.min(policy.delay * Math.pow(2, attempt - 1), policy.maxDelay || 30000)
            : policy.delay * attempt
          
          await new Promise(resolve => setTimeout(resolve, delay))
          
          this.emit('retry', {
            attempt,
            error: lastError,
            nextDelay: delay
          })
        }
      }
    }
    
    throw lastError!
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          const error = new Error(`Operation timed out after ${this.options.timeout}ms`)
          this.recordTimeout()
          reject(error)
        }, this.options.timeout)
      })
    ])
  }

  /**
   * Handle open circuit
   */
  private async handleOpen<T>(fallback?: () => T | Promise<T>): Promise<T> {
    this.emit('reject', { state: this.state })
    
    if (fallback) {
      return fallback()
    } else if (this.options.fallback) {
      return this.options.fallback()
    }
    
    throw new CircuitBreakerError(
      `Circuit breaker is ${this.state}`,
      this.state
    )
  }

  /**
   * Check if circuit should trip to open
   */
  private shouldTrip(): boolean {
    const metrics = this.calculateMetrics()
    
    // Not enough requests to trip
    if (metrics.requestCount < this.options.requestVolumeThreshold) {
      return false
    }
    
    // Check error percentage
    return metrics.errorPercentage >= this.options.errorThresholdPercentage
  }

  /**
   * Check if we should attempt to reset
   */
  private shouldAttemptReset(): boolean {
    return Date.now() >= (this.nextAttemptTime || 0)
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    if (this.state === newState) return
    
    const oldState = this.state
    this.state = newState
    this.lastStateChangeTime = Date.now()
    this.stats.state = newState
    this.stats.lastStateChange = new Date()
    
    if (newState === CircuitState.OPEN) {
      this.nextAttemptTime = Date.now() + this.options.sleepWindowMs
      this.stats.nextAttempt = new Date(this.nextAttemptTime)
    } else {
      this.nextAttemptTime = undefined
      this.stats.nextAttempt = undefined
    }
    
    this.emit('stateChange', {
      from: oldState,
      to: newState,
      timestamp: new Date()
    })
  }

  /**
   * Record successful request
   */
  private recordSuccess(responseTime: number): void {
    const bucket = this.getCurrentBucket()
    bucket.success++
    bucket.responseTime.push(responseTime)
    this.updateStats()
    
    this.emit('success', { responseTime })
  }

  /**
   * Record failed request
   */
  private recordFailure(error: Error, responseTime: number): void {
    const bucket = this.getCurrentBucket()
    bucket.failure++
    bucket.responseTime.push(responseTime)
    this.stats.lastError = error
    this.updateStats()
    
    this.emit('failure', { error, responseTime })
  }

  /**
   * Record timeout
   */
  private recordTimeout(): void {
    const bucket = this.getCurrentBucket()
    bucket.timeout++
    bucket.failure++
    this.updateStats()
    
    this.emit('timeout', {})
  }

  /**
   * Initialize buckets
   */
  private initializeBuckets(): void {
    const now = Date.now()
    for (let i = 0; i < this.options.bucketNum; i++) {
      this.requestBuckets.push({
        timestamp: now - (i * this.options.bucketSize),
        success: 0,
        failure: 0,
        timeout: 0,
        responseTime: []
      })
    }
  }

  /**
   * Start bucket rotation
   */
  private startBucketRotation(): void {
    setInterval(() => {
      this.rotateBuckets()
    }, this.options.bucketSize)
  }

  /**
   * Rotate buckets
   */
  private rotateBuckets(): void {
    this.requestBuckets.pop()
    this.requestBuckets.unshift({
      timestamp: Date.now(),
      success: 0,
      failure: 0,
      timeout: 0,
      responseTime: []
    })
    this.updateStats()
  }

  /**
   * Get current bucket
   */
  private getCurrentBucket() {
    return this.requestBuckets[0]
  }

  /**
   * Calculate metrics from buckets
   */
  private calculateMetrics() {
    let totalSuccess = 0
    let totalFailure = 0
    let totalTimeout = 0
    let allResponseTimes: number[] = []
    
    this.requestBuckets.forEach(bucket => {
      totalSuccess += bucket.success
      totalFailure += bucket.failure
      totalTimeout += bucket.timeout
      allResponseTimes = allResponseTimes.concat(bucket.responseTime)
    })
    
    const totalRequests = totalSuccess + totalFailure
    const errorPercentage = totalRequests > 0 
      ? (totalFailure / totalRequests) * 100 
      : 0
    
    const avgResponseTime = allResponseTimes.length > 0
      ? allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length
      : 0
    
    return {
      requestCount: totalRequests,
      errorCount: totalFailure,
      successCount: totalSuccess,
      timeoutCount: totalTimeout,
      errorPercentage,
      avgResponseTime
    }
  }

  /**
   * Update statistics
   */
  private updateStats(): void {
    this.stats.metrics = this.calculateMetrics()
  }

  /**
   * Get current statistics
   */
  getStats(): CircuitBreakerStats {
    return { ...this.stats }
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state
  }

  /**
   * Manually reset the circuit
   */
  reset(): void {
    this.transitionTo(CircuitState.CLOSED)
    this.requestBuckets = []
    this.initializeBuckets()
    this.halfOpenRequests = 0
    this.updateStats()
    
    this.emit('reset', {})
  }

  /**
   * Manually trip the circuit
   */
  trip(): void {
    this.transitionTo(CircuitState.OPEN)
    this.emit('trip', {})
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const isHealthy = await this.options.healthCheck()
      if (isHealthy && this.state === CircuitState.OPEN) {
        this.transitionTo(CircuitState.HALF_OPEN)
      }
      return isHealthy
    } catch {
      return false
    }
  }

  /**
   * Destroy the circuit breaker
   */
  destroy(): void {
    this.removeAllListeners()
  }
}

/**
 * Circuit Breaker Factory
 */
export class CircuitBreakerFactory {
  private static breakers = new Map<string, CircuitBreaker>()

  static create(options: CircuitBreakerOptions): CircuitBreaker {
    if (this.breakers.has(options.name)) {
      return this.breakers.get(options.name)!
    }
    
    const breaker = new CircuitBreaker(options)
    this.breakers.set(options.name, breaker)
    return breaker
  }

  static get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name)
  }

  static getAll(): Map<string, CircuitBreaker> {
    return new Map(this.breakers)
  }

  static destroy(name: string): void {
    const breaker = this.breakers.get(name)
    if (breaker) {
      breaker.destroy()
      this.breakers.delete(name)
    }
  }

  static destroyAll(): void {
    this.breakers.forEach(breaker => breaker.destroy())
    this.breakers.clear()
  }
}