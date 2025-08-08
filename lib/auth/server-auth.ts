// 서버 사이드 인증 유틸리티
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server-admin'
import { redirect } from 'next/navigation'
import { UserRole, PAGE_ACCESS } from './role-check'

export interface AuthUser {
  id: string
  email: string
  role: UserRole
  fullName?: string
  storeId?: string
  storeName?: string
}

/**
 * 서버 컴포넌트에서 인증된 사용자 정보를 가져옵니다.
 * 인증되지 않은 경우 로그인 페이지로 리다이렉트
 */
export async function getAuthUser(): Promise<AuthUser> {
  const supabase = await createClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    redirect('/login')
  }
  
  // Admin 클라이언트로 프로필 정보 가져오기 (RLS 우회)
  try {
    const adminClient = createAdminClient()
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()
    
    // 직원 정보 가져오기
    const { data: employee } = await adminClient
      .from('employees')
      .select(`
        store_id,
        stores (
          id,
          name
        )
      `)
      .eq('user_id', user.id)
      .single()
    
    return {
      id: user.id,
      email: user.email!,
      role: (profile?.role as UserRole) || 'employee',
      fullName: profile?.full_name,
      storeId: employee?.store_id,
      storeName: (employee as any)?.stores?.name
    }
  } catch (error) {
    console.error('Error fetching user profile:', error)
    // 폴백: 기본 정보만 반환
    return {
      id: user.id,
      email: user.email!,
      role: 'employee'
    }
  }
}

/**
 * 페이지별 권한을 체크합니다.
 * 권한이 없는 경우 대시보드로 리다이렉트
 */
export async function checkPageAccess(pathname: string): Promise<AuthUser> {
  const user = await getAuthUser()
  
  // 페이지별 권한 체크
  const pathKey = Object.keys(PAGE_ACCESS).find(path => 
    pathname.startsWith(path)
  ) as keyof typeof PAGE_ACCESS
  
  if (pathKey) {
    const allowedRoles = PAGE_ACCESS[pathKey] as readonly UserRole[]
    if (!allowedRoles.includes(user.role)) {
      console.warn(`Access denied: ${user.role} tried to access ${pathname}`)
      redirect('/dashboard')
    }
  }
  
  return user
}

/**
 * 특정 역할이 필요한 페이지에서 사용
 */
export async function requireRole(requiredRoles: UserRole[]): Promise<AuthUser> {
  const user = await getAuthUser()
  
  if (!requiredRoles.includes(user.role)) {
    console.warn(`Role mismatch: ${user.role} not in ${requiredRoles}`)
    redirect('/dashboard')
  }
  
  return user
}