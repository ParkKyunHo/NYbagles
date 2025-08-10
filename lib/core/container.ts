/**
 * Dependency Injection Container
 * 의존성 주입 컨테이너 - 서비스 생명주기 관리 및 의존성 해결
 */

import { 
  Constructor, 
  ServiceProvider, 
  ServiceScope, 
  ServiceMetadata,
  ServiceDescriptor,
  ModuleContext,
  ServiceEvent,
  ServiceEventPayload
} from './types'

export class DIContainer {
  private static instance: DIContainer
  private services = new Map<string | symbol, ServiceMetadata>()
  private singletons = new Map<string | symbol, any>()
  private factories = new Map<string | symbol, Function>()
  private requestScoped = new WeakMap<any, Map<string | symbol, any>>()
  private moduleContexts = new Map<string, ModuleContext>()
  private eventListeners = new Map<ServiceEvent, Set<(payload: ServiceEventPayload) => void>>()
  private circuitBreakers = new Map<string, any>()

  private constructor() {}

  static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer()
    }
    return DIContainer.instance
  }

  /**
   * Register a service provider
   */
  register<T>(provider: ServiceProvider): void {
    const { provide, useClass, useFactory, useValue, deps = [], scope = ServiceScope.SINGLETON } = provider
    
    const metadata: ServiceMetadata = {
      token: provide,
      scope,
      dependencies: deps
    }

    if (useValue !== undefined) {
      this.singletons.set(provide, useValue)
      metadata.factory = () => useValue
    } else if (useFactory) {
      metadata.factory = useFactory
      this.factories.set(provide, useFactory)
    } else if (useClass) {
      metadata.factory = () => this.createInstance(useClass, deps)
      this.services.set(provide, metadata)
    }

    this.emit(ServiceEvent.CREATED, {
      service: String(provide),
      event: ServiceEvent.CREATED,
      timestamp: new Date()
    })
  }

  /**
   * Resolve a service by token
   */
  resolve<T>(token: string | symbol, context?: any): T {
    try {
      // Check if service exists
      if (!this.services.has(token) && !this.singletons.has(token) && !this.factories.has(token)) {
        throw new Error(`Service ${String(token)} not found in container`)
      }

      // Return singleton if exists
      if (this.singletons.has(token)) {
        return this.singletons.get(token)
      }

      const metadata = this.services.get(token)
      
      if (!metadata) {
        // Try factory
        const factory = this.factories.get(token)
        if (factory) {
          return this.executeWithErrorHandling(token, () => factory())
        }
        throw new Error(`No metadata found for service ${String(token)}`)
      }

      // Handle different scopes
      switch (metadata.scope) {
        case ServiceScope.SINGLETON:
          if (!this.singletons.has(token)) {
            const instance = this.executeWithErrorHandling(token, () => 
              this.createServiceInstance(metadata)
            )
            this.singletons.set(token, instance)
          }
          return this.singletons.get(token)

        case ServiceScope.REQUEST:
          if (context) {
            if (!this.requestScoped.has(context)) {
              this.requestScoped.set(context, new Map())
            }
            const requestServices = this.requestScoped.get(context)!
            if (!requestServices.has(token)) {
              const instance = this.executeWithErrorHandling(token, () =>
                this.createServiceInstance(metadata)
              )
              requestServices.set(token, instance)
            }
            return requestServices.get(token)
          }
          // Fallback to transient if no context
          return this.executeWithErrorHandling(token, () =>
            this.createServiceInstance(metadata)
          )

        case ServiceScope.TRANSIENT:
        default:
          return this.executeWithErrorHandling(token, () =>
            this.createServiceInstance(metadata)
          )
      }
    } catch (error) {
      this.emit(ServiceEvent.ERROR, {
        service: String(token),
        event: ServiceEvent.ERROR,
        timestamp: new Date(),
        error: error as Error
      })
      throw error
    }
  }

  /**
   * Create service instance with dependencies
   */
  private createServiceInstance(metadata: ServiceMetadata): any {
    if (metadata.factory) {
      const deps = (metadata.dependencies || []).map(dep => this.resolve(dep))
      return (metadata.factory as any)(...deps)
    }
    throw new Error(`No factory found for service ${String(metadata.token)}`)
  }

  /**
   * Create class instance with dependency injection
   */
  private createInstance<T>(constructor: Constructor<T>, deps: Array<string | symbol> = []): T {
    const resolvedDeps = deps.map(dep => this.resolve(dep))
    return new (constructor as any)(...resolvedDeps)
  }

  /**
   * Execute with error handling and metrics
   */
  private executeWithErrorHandling<T>(
    token: string | symbol, 
    operation: () => T
  ): T {
    const startTime = Date.now()
    try {
      const result = operation()
      this.updateMetrics(token, true, Date.now() - startTime)
      return result
    } catch (error) {
      this.updateMetrics(token, false, Date.now() - startTime, error as Error)
      throw error
    }
  }

  /**
   * Update service metrics
   */
  private updateMetrics(
    token: string | symbol, 
    success: boolean, 
    responseTime: number,
    error?: Error
  ): void {
    // This would integrate with monitoring system
    // For now, just emit event
    if (!success && error) {
      this.emit(ServiceEvent.ERROR, {
        service: String(token),
        event: ServiceEvent.ERROR,
        timestamp: new Date(),
        error,
        data: { responseTime }
      })
    }
  }

  /**
   * Create a module context for isolation
   */
  createModuleContext(name: string, parent?: ModuleContext): ModuleContext {
    const context: ModuleContext = {
      name,
      providers: new Map(),
      imports: new Set(),
      exports: new Set(),
      parent
    }
    
    this.moduleContexts.set(name, context)
    return context
  }

  /**
   * Register a module with its providers
   */
  registerModule(
    name: string,
    providers: ServiceProvider[],
    imports: Constructor[] = [],
    exports: Array<string | symbol> = []
  ): void {
    const context = this.createModuleContext(name)
    
    // Register providers
    providers.forEach(provider => {
      this.register(provider)
      context.providers.set(provider.provide, provider)
    })
    
    // Set imports and exports
    imports.forEach(imp => context.imports.add(imp))
    exports.forEach(exp => context.exports.add(exp))
  }

  /**
   * Check if a service is healthy
   */
  async checkHealth(token: string | symbol): Promise<boolean> {
    try {
      const service = this.resolve(token) as any
      if (service && typeof service.healthCheck === 'function') {
        const health = await service.healthCheck()
        this.emit(ServiceEvent.HEALTH_CHECK, {
          service: String(token),
          event: ServiceEvent.HEALTH_CHECK,
          timestamp: new Date(),
          data: { health }
        })
        return health.status === 'healthy'
      }
      return true
    } catch {
      return false
    }
  }

  /**
   * Clear request-scoped services
   */
  clearRequestScope(context: any): void {
    if (this.requestScoped.has(context)) {
      const services = this.requestScoped.get(context)!
      services.forEach((service, token) => {
        if (service && typeof service.onDestroy === 'function') {
          service.onDestroy()
        }
        this.emit(ServiceEvent.DESTROYED, {
          service: String(token),
          event: ServiceEvent.DESTROYED,
          timestamp: new Date()
        })
      })
      this.requestScoped.delete(context)
    }
  }

  /**
   * Get service descriptor for introspection
   */
  getServiceDescriptor(token: string | symbol): ServiceDescriptor | null {
    const metadata = this.services.get(token)
    if (!metadata) return null

    return {
      name: String(token),
      type: metadata.factory as Function,
      scope: metadata.scope,
      dependencies: (metadata.dependencies || []).map(String),
      metadata: {}
    }
  }

  /**
   * List all registered services
   */
  listServices(): Array<{ token: string | symbol; scope: ServiceScope }> {
    const services: Array<{ token: string | symbol; scope: ServiceScope }> = []
    
    this.services.forEach((metadata, token) => {
      services.push({ token, scope: metadata.scope })
    })
    
    return services
  }

  /**
   * Subscribe to service events
   */
  on(event: ServiceEvent, listener: (payload: ServiceEventPayload) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(listener)
  }

  /**
   * Emit service event
   */
  private emit(event: ServiceEvent, payload: ServiceEventPayload): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach(listener => listener(payload))
    }
  }

  /**
   * Clear all services (for testing)
   */
  clear(): void {
    this.services.clear()
    this.singletons.clear()
    this.factories.clear()
    this.requestScoped = new WeakMap()
    this.moduleContexts.clear()
    this.circuitBreakers.clear()
  }

  /**
   * Dispose of the container
   */
  async dispose(): Promise<void> {
    // Destroy all singletons
    for (const [token, service] of this.singletons) {
      if (service && typeof service.onDestroy === 'function') {
        await service.onDestroy()
      }
      this.emit(ServiceEvent.DESTROYED, {
        service: String(token),
        event: ServiceEvent.DESTROYED,
        timestamp: new Date()
      })
    }
    
    this.clear()
  }
}

// Export singleton instance
export const container = DIContainer.getInstance()