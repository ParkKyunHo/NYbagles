import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/middleware'
import { PAGE_ACCESS, UserRole } from '@/lib/auth/role-check'

export async function roleGuardMiddleware(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createClient(request, response)
  
  const pathname = request.nextUrl.pathname
  
  // 인증이 필요없는 경로
  const publicPaths = ['/login', '/signup', '/', '/api/auth']
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return response
  }
  
  try {
    // 사용자 인증 확인
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    
    // 사용자 역할 확인
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    if (!profile) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    
    const userRole = profile.role as UserRole
    
    // 경로별 권한 확인
    const pathKey = Object.keys(PAGE_ACCESS).find(path => 
      pathname.startsWith(path)
    ) as keyof typeof PAGE_ACCESS
    
    if (pathKey) {
      const allowedRoles = PAGE_ACCESS[pathKey] as readonly UserRole[]
      if (!allowedRoles.includes(userRole)) {
        // 권한이 없는 경우 대시보드로 리다이렉트
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
    
    // 역할별 대시보드 리다이렉트 (선택적)
    if (pathname === '/dashboard') {
      // 역할에 따른 기본 대시보드는 클라이언트에서 처리
      return response
    }
    
    return response
  } catch (error) {
    console.error('Role guard error:', error)
    return NextResponse.redirect(new URL('/login', request.url))
  }
}