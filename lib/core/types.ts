/**
 * Core Types for Dependency Injection System
 * 의존성 주입 시스템의 핵심 타입 정의
 */

// Service lifecycle scopes
export enum ServiceScope {
  SINGLETON = 'singleton',     // 전체 애플리케이션에서 하나의 인스턴스
  TRANSIENT = 'transient',     // 매번 새로운 인스턴스 생성
  REQUEST = 'request'          // 요청당 하나의 인스턴스
}

// Service metadata
export interface ServiceMetadata {
  token: string | symbol
  scope: ServiceScope
  factory?: () => any
  dependencies?: Array<string | symbol>
  tags?: string[]
}

// Constructor type
export type Constructor<T = {}> = new (...args: any[]) => T

// Service provider interface
export interface ServiceProvider {
  provide: string | symbol
  useClass?: Constructor
  useFactory?: (...args: any[]) => any
  useValue?: any
  deps?: Array<string | symbol>
  scope?: ServiceScope
}

// Module metadata
export interface ModuleMetadata {
  imports?: Constructor[]
  providers?: ServiceProvider[]
  exports?: Array<string | symbol>
  controllers?: Constructor[]
}

// Injection token
export class InjectionToken<T> {
  constructor(
    public readonly name: string,
    public readonly options?: {
      providedIn?: 'root' | 'module'
      factory?: () => T
    }
  ) {}

  toString(): string {
    return `InjectionToken(${this.name})`
  }
}

// Service health status
export interface ServiceHealth {
  service: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  lastCheck: Date
  details?: Record<string, any>
}

// Circuit breaker state
export enum CircuitState {
  CLOSED = 'closed',     // 정상 작동
  OPEN = 'open',         // 차단됨
  HALF_OPEN = 'half_open' // 테스트 중
}

// Retry policy configuration
export interface RetryPolicy {
  maxAttempts: number
  delay: number
  maxDelay?: number
  backoff?: 'linear' | 'exponential'
  retryOn?: (error: Error) => boolean
}

// Fallback configuration
export interface FallbackConfig<T> {
  fallbackValue?: T
  fallbackFactory?: () => T | Promise<T>
  timeout?: number
}

// Transaction context
export interface TransactionContext {
  id: string
  startTime: Date
  operations: Array<{
    service: string
    method: string
    status: 'pending' | 'completed' | 'failed'
    error?: Error
  }>
  rollback?: () => Promise<void>
}

// Module context for isolated execution
export interface ModuleContext {
  name: string
  providers: Map<string | symbol, any>
  imports: Set<Constructor>
  exports: Set<string | symbol>
  parent?: ModuleContext
}

// Service descriptor for runtime introspection
export interface ServiceDescriptor {
  name: string
  type: Constructor | Function
  scope: ServiceScope
  dependencies: string[]
  metadata: Record<string, any>
  health?: ServiceHealth
  metrics?: {
    callCount: number
    errorCount: number
    avgResponseTime: number
    lastError?: Error
  }
}

// Event types for monitoring
export enum ServiceEvent {
  CREATED = 'service.created',
  DESTROYED = 'service.destroyed',
  ERROR = 'service.error',
  HEALTH_CHECK = 'service.health_check',
  CIRCUIT_OPEN = 'circuit.open',
  CIRCUIT_CLOSE = 'circuit.close',
  RETRY = 'service.retry',
  FALLBACK = 'service.fallback'
}

// Service event payload
export interface ServiceEventPayload {
  service: string
  event: ServiceEvent
  timestamp: Date
  data?: Record<string, any>
  error?: Error
}

// Service lifecycle hooks
export interface OnModuleInit {
  onModuleInit(): Promise<void> | void
}

export interface OnModuleDestroy {
  onModuleDestroy(): Promise<void> | void
}

export interface OnApplicationBootstrap {
  onApplicationBootstrap(): Promise<void> | void
}

export interface OnApplicationShutdown {
  onApplicationShutdown(signal?: string): Promise<void> | void
}