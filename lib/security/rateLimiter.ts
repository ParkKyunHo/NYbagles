import { NextRequest } from 'next/server'

// In-memory store for rate limiting (can be replaced with Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export interface RateLimitConfig {
  windowMs: number  // Time window in milliseconds
  maxRequests: number  // Maximum requests per window
  keyGenerator?: (req: NextRequest) => string  // Custom key generator
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60 * 1000,  // 1 minute
  maxRequests: 60,  // 60 requests per minute
}

export class RateLimiter {
  private config: RateLimitConfig

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
  }

  private getKey(req: NextRequest): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(req)
    }
    
    // Default: Use IP address as key
    const forwardedFor = req.headers.get('x-forwarded-for')
    const realIp = req.headers.get('x-real-ip')
    const ip = forwardedFor?.split(',')[0] || realIp || 'unknown'
    
    return `ratelimit:${ip}`
  }

  async checkLimit(req: NextRequest): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = this.getKey(req)
    const now = Date.now()
    
    // Clean up expired entries
    this.cleanup()
    
    const record = rateLimitStore.get(key)
    
    if (!record || now > record.resetTime) {
      // First request or window expired
      const resetTime = now + this.config.windowMs
      rateLimitStore.set(key, { count: 1, resetTime })
      
      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetTime
      }
    }
    
    if (record.count >= this.config.maxRequests) {
      // Rate limit exceeded
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.resetTime
      }
    }
    
    // Increment counter
    record.count++
    rateLimitStore.set(key, record)
    
    return {
      allowed: true,
      remaining: this.config.maxRequests - record.count,
      resetTime: record.resetTime
    }
  }

  private cleanup() {
    const now = Date.now()
    const entries = Array.from(rateLimitStore.entries())
    for (const [key, record] of entries) {
      if (now > record.resetTime) {
        rateLimitStore.delete(key)
      }
    }
  }
}

// Pre-configured rate limiters for different endpoints
export const rateLimiters = {
  // Strict limit for auth endpoints (회원가입은 제외)
  auth: new RateLimiter({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    maxRequests: 10  // 10 attempts per 15 minutes (테스트를 위해 완화)
  }),
  
  // Standard API limit
  api: new RateLimiter({
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 60  // 60 requests per minute
  }),
  
  // Relaxed limit for QR generation (for managers)
  qr: new RateLimiter({
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 30  // 30 QR codes per minute
  })
}