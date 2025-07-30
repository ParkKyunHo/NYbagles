import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { rateLimiters } from '@/lib/security/rateLimiter'
import { applySecurityHeaders } from '@/lib/security/headers'
import { corsMiddleware } from '@/lib/security/cors'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Apply rate limiting based on path
  let rateLimiter = rateLimiters.api // default rate limiter
  
  if (pathname.startsWith('/api/auth/')) {
    // 회원가입 엔드포인트는 일반 API rate limit 사용
    if (pathname.includes('/signup')) {
      rateLimiter = rateLimiters.api
    } else {
      rateLimiter = rateLimiters.auth
    }
  } else if (pathname.startsWith('/api/qr/')) {
    rateLimiter = rateLimiters.qr
  }

  // Check rate limit
  const { allowed, remaining, resetTime } = await rateLimiter.checkLimit(request)
  
  if (!allowed) {
    const response = NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
    response.headers.set('X-RateLimit-Limit', rateLimiter['config'].maxRequests.toString())
    response.headers.set('X-RateLimit-Remaining', '0')
    response.headers.set('X-RateLimit-Reset', new Date(resetTime).toISOString())
    response.headers.set('Retry-After', Math.ceil((resetTime - Date.now()) / 1000).toString())
    
    return applySecurityHeaders(response)
  }

  // Update Supabase session
  let response = await updateSession(request)

  // Apply security headers
  response = applySecurityHeaders(response)

  // Apply CORS for API routes
  if (pathname.startsWith('/api/')) {
    response = corsMiddleware(request, response)
  }

  // Add rate limit headers
  response.headers.set('X-RateLimit-Limit', rateLimiter['config'].maxRequests.toString())
  response.headers.set('X-RateLimit-Remaining', remaining.toString())
  response.headers.set('X-RateLimit-Reset', new Date(resetTime).toISOString())

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}