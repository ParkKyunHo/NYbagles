/**
 * Decorators for Dependency Injection
 * 의존성 주입을 위한 데코레이터
 */

import 'reflect-metadata'
import { container } from './container'
import { ServiceScope, Constructor, ModuleMetadata, ServiceProvider } from './types'

// Metadata keys
const INJECTABLE_METADATA = Symbol('injectable')
const INJECT_METADATA = Symbol('inject')
const MODULE_METADATA = Symbol('module')
const PARAM_TYPES = 'design:paramtypes'
const PROPERTY_TYPES = 'design:type'

/**
 * Mark a class as injectable
 */
export function Injectable(options?: {
  scope?: ServiceScope
  providedIn?: 'root' | string
}): ClassDecorator {
  return (target: any) => {
    const scope = options?.scope || ServiceScope.SINGLETON
    const providedIn = options?.providedIn || 'root'
    
    // Get constructor parameters
    const paramTypes = Reflect.getMetadata(PARAM_TYPES, target) || []
    
    // Store metadata
    Reflect.defineMetadata(INJECTABLE_METADATA, {
      scope,
      providedIn,
      dependencies: paramTypes
    }, target)
    
    // Auto-register if provided in root
    if (providedIn === 'root') {
      container.register({
        provide: target.name,
        useClass: target,
        scope,
        deps: paramTypes
      })
    }
    
    return target
  }
}

/**
 * Inject a dependency by token
 */
export function Inject(token: string | symbol): ParameterDecorator & PropertyDecorator {
  return (target: any, propertyKey: string | symbol | undefined, parameterIndex?: number) => {
    if (propertyKey === undefined && typeof parameterIndex === 'number') {
      // Parameter injection
      const existingTokens = Reflect.getMetadata(INJECT_METADATA, target) || []
      existingTokens[parameterIndex] = token
      Reflect.defineMetadata(INJECT_METADATA, existingTokens, target)
    } else if (propertyKey) {
      // Property injection
      const getter = () => container.resolve(token)
      
      Object.defineProperty(target, propertyKey, {
        get: getter,
        enumerable: true,
        configurable: true
      })
    }
  }
}

/**
 * Mark a class as a module
 */
export function Module(metadata: ModuleMetadata): ClassDecorator {
  return (target: any) => {
    Reflect.defineMetadata(MODULE_METADATA, metadata, target)
    
    // Register module in container
    const providers = metadata.providers || []
    const imports = metadata.imports || []
    const exports = metadata.exports || []
    
    container.registerModule(
      target.name,
      providers,
      imports,
      exports
    )
    
    return target
  }
}

/**
 * Mark a method as a provider factory
 */
export function Provides(token: string | symbol): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value
    
    // Register factory in container
    container.register({
      provide: token,
      useFactory: (...args: any[]) => originalMethod.apply(target, args),
      scope: ServiceScope.SINGLETON
    })
    
    return descriptor
  }
}

/**
 * Optional injection (won't throw if not found)
 */
export function Optional(): ParameterDecorator & PropertyDecorator {
  return (target: any, propertyKey: string | symbol | undefined, parameterIndex?: number) => {
    // Mark as optional in metadata
    const key = propertyKey || `constructor:${parameterIndex}`
    const optionals = Reflect.getMetadata('optional:params', target) || new Set()
    optionals.add(key)
    Reflect.defineMetadata('optional:params', optionals, target)
  }
}

/**
 * Service scope decorators
 */
export const Singleton = () => Injectable({ scope: ServiceScope.SINGLETON })
export const Transient = () => Injectable({ scope: ServiceScope.TRANSIENT })
export const RequestScoped = () => Injectable({ scope: ServiceScope.REQUEST })

/**
 * Lifecycle hook decorators
 */
export function OnInit(): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const hooks = Reflect.getMetadata('lifecycle:hooks', target) || {}
    hooks.onInit = propertyKey
    Reflect.defineMetadata('lifecycle:hooks', hooks, target)
    return descriptor
  }
}

export function OnDestroy(): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const hooks = Reflect.getMetadata('lifecycle:hooks', target) || {}
    hooks.onDestroy = propertyKey
    Reflect.defineMetadata('lifecycle:hooks', hooks, target)
    return descriptor
  }
}

/**
 * Health check decorator
 */
export function HealthCheck(): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('health:check', propertyKey, target)
    return descriptor
  }
}

/**
 * Cache decorator for method results
 */
export function Cacheable(ttl: number = 60000): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value
    const cache = new Map<string, { value: any; expiry: number }>()
    
    descriptor.value = async function(...args: any[]) {
      const key = JSON.stringify(args)
      const cached = cache.get(key)
      
      if (cached && cached.expiry > Date.now()) {
        return cached.value
      }
      
      const result = await originalMethod.apply(this, args)
      cache.set(key, {
        value: result,
        expiry: Date.now() + ttl
      })
      
      return result
    }
    
    return descriptor
  }
}

/**
 * Retry decorator for resilience
 */
export function Retry(options: {
  maxAttempts?: number
  delay?: number
  backoff?: 'linear' | 'exponential'
} = {}): MethodDecorator {
  const { maxAttempts = 3, delay = 1000, backoff = 'exponential' } = options
  
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value
    
    descriptor.value = async function(...args: any[]) {
      let lastError: Error
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await originalMethod.apply(this, args)
        } catch (error) {
          lastError = error as Error
          
          if (attempt < maxAttempts) {
            const waitTime = backoff === 'exponential' 
              ? delay * Math.pow(2, attempt - 1)
              : delay * attempt
            
            await new Promise(resolve => setTimeout(resolve, waitTime))
          }
        }
      }
      
      throw lastError!
    }
    
    return descriptor
  }
}

/**
 * Timeout decorator
 */
export function Timeout(ms: number): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value
    
    descriptor.value = async function(...args: any[]) {
      return Promise.race([
        originalMethod.apply(this, args),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Method ${String(propertyKey)} timed out after ${ms}ms`)), ms)
        )
      ])
    }
    
    return descriptor
  }
}

/**
 * Validate decorator for parameter validation
 */
export function Validate(validator: (value: any) => boolean | string): ParameterDecorator {
  return (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    const validators = Reflect.getMetadata('validators', target, propertyKey!) || []
    validators[parameterIndex] = validator
    Reflect.defineMetadata('validators', validators, target, propertyKey!)
  }
}

/**
 * Log decorator for method logging
 */
export function Log(prefix?: string): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value
    
    descriptor.value = async function(...args: any[]) {
      const className = target.constructor.name
      const methodName = String(propertyKey)
      const logPrefix = prefix || `${className}.${methodName}`
      
      console.log(`[${logPrefix}] Called with:`, args)
      const startTime = Date.now()
      
      try {
        const result = await originalMethod.apply(this, args)
        console.log(`[${logPrefix}] Completed in ${Date.now() - startTime}ms`)
        return result
      } catch (error) {
        console.error(`[${logPrefix}] Failed after ${Date.now() - startTime}ms:`, error)
        throw error
      }
    }
    
    return descriptor
  }
}

/**
 * Create a custom decorator factory
 */
export function createDecorator<T = any>(
  handler: (options: T) => (target: any, propertyKey?: string | symbol, descriptor?: any) => any
) {
  return (options: T) => handler(options)
}