import { type NextRequest, NextResponse } from 'next/server'
import { createMiddlewareClient, refreshSession } from '@/lib/supabase/auth-helpers'
import { rateLimiters } from '@/lib/security/rateLimiter'
import { applySecurityHeaders } from '@/lib/security/headers'
import { corsMiddleware } from '@/lib/security/cors'
import { PAGE_ACCESS, type UserRole } from '@/lib/auth/role-check'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Create response object early
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Apply rate limiting based on path
  let rateLimiter = rateLimiters.api
  
  if (pathname.startsWith('/api/auth/')) {
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
    const errorResponse = NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
    errorResponse.headers.set('X-RateLimit-Limit', rateLimiter['config'].maxRequests.toString())
    errorResponse.headers.set('X-RateLimit-Remaining', '0')
    errorResponse.headers.set('X-RateLimit-Reset', new Date(resetTime).toISOString())
    errorResponse.headers.set('Retry-After', Math.ceil((resetTime - Date.now()) / 1000).toString())
    
    return applySecurityHeaders(errorResponse)
  }

  // Public paths that don't require authentication
  const publicPaths = ['/', '/login', '/signup', '/api/auth', '/forgot-password']
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path))
  
  // Protected paths that require authentication
  const protectedPaths = ['/dashboard', '/admin', '/attendance', '/products', '/sales', '/schedule']
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path))
  
  // Handle authentication for protected paths
  if (isProtectedPath && !pathname.startsWith('/api/')) {
    const supabase = createMiddlewareClient(request, response)
    
    // Get user session
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      // Redirect to login if not authenticated
      return NextResponse.redirect(new URL('/login', request.url))
    }
    
    // Check role-based access for specific paths
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    if (profile) {
      const userRole = profile.role as UserRole
      
      // Find matching access rule
      const pathKey = Object.keys(PAGE_ACCESS).find(path => 
        pathname.startsWith(path)
      ) as keyof typeof PAGE_ACCESS
      
      if (pathKey) {
        const allowedRoles = PAGE_ACCESS[pathKey] as readonly UserRole[]
        if (!allowedRoles.includes(userRole)) {
          // Return 403 Forbidden instead of redirecting
          const errorResponse = NextResponse.json(
            { error: '접근 권한이 없습니다.' },
            { status: 403 }
          )
          return applySecurityHeaders(errorResponse)
        }
      }
    }
    
    // Refresh session to maintain authentication
    response = await refreshSession(request, response)
  }
  
  // Redirect authenticated users away from login page
  if (pathname === '/login' && !pathname.startsWith('/api/')) {
    const supabase = createMiddlewareClient(request, response)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

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
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}