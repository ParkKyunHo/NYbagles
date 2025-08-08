import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { PAGE_ACCESS, hasAccess, type UserRole } from '@/lib/auth/role-check'

export function createClient(request: NextRequest, response: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Check role-based access for protected routes
  if (user) {
    const path = request.nextUrl.pathname
    
    // Find matching route pattern
    const matchingRoute = Object.keys(PAGE_ACCESS).find(route => {
      // Exact match or prefix match for dashboard routes
      return path === route || (route.endsWith('/') && path.startsWith(route))
    })
    
    if (matchingRoute) {
      // Get user profile to check role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      
      const userRole = (profile?.role || 'employee') as UserRole
      const allowedRoles = PAGE_ACCESS[matchingRoute as keyof typeof PAGE_ACCESS]
      
      if (!hasAccess(userRole, allowedRoles)) {
        // Redirect to dashboard if no access
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
  } else if (request.nextUrl.pathname.startsWith('/dashboard') || 
             request.nextUrl.pathname.startsWith('/admin') ||
             request.nextUrl.pathname.startsWith('/sales') ||
             request.nextUrl.pathname.startsWith('/products')) {
    // Redirect to login if not authenticated
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}