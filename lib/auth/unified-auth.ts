/**
 * 통합 인증 시스템
 * Enterprise-grade authentication with centralized logic
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server-admin'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { UserRole, PAGE_ACCESS } from './role-check'

// 사용자 정보 타입 정의
export interface AuthUser {
  id: string
  email: string
  role: UserRole
  fullName?: string
  storeId?: string
  storeName?: string
  employeeId?: string
  position?: string
  isActive: boolean
}

// 인증 에러 클래스
export class AuthenticationError extends Error {
  constructor(
    message: string,
    public code: 'UNAUTHENTICATED' | 'UNAUTHORIZED' | 'SESSION_EXPIRED' | 'INACTIVE_USER' = 'UNAUTHENTICATED',
    public redirectTo: string = '/login'
  ) {
    super(message)
    this.name = 'AuthenticationError'
  }
}

/**
 * 캐시된 사용자 정보 가져오기 (서버 컴포넌트용)
 * React의 cache 함수를 사용하여 요청 수명 주기 동안 캐싱
 */
export const getCachedAuthUser = cache(async (): Promise<AuthUser | null> => {
  try {
    const supabase = await createClient()
    
    // 1. Supabase 인증 확인
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      console.log('[Auth] No authenticated user found')
      return null
    }
    
    // 2. Admin 클라이언트로 완전한 사용자 정보 가져오기 (RLS 우회)
    const adminClient = createAdminClient()
    
    // 3. 프로필 정보 가져오기
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, email, role, full_name')
      .eq('id', user.id)
      .single()
    
    if (profileError || !profile) {
      console.error('[Auth] Profile fetch error:', profileError)
      return null
    }
    
    // 4. 직원 정보 가져오기 (직원인 경우)
    let employeeInfo = {
      employeeId: undefined as string | undefined,
      storeId: undefined as string | undefined,
      storeName: undefined as string | undefined,
      position: undefined as string | undefined,
      isActive: true
    }
    
    if (profile.role !== 'super_admin') {
      const { data: employee, error: employeeError } = await adminClient
        .from('employees')
        .select(`
          id,
          store_id,
          position,
          is_active,
          stores (
            id,
            name,
            is_active
          )
        `)
        .eq('user_id', user.id)
        .single()
      
      if (employee) {
        employeeInfo = {
          employeeId: employee.id,
          storeId: employee.store_id,
          storeName: (employee as any)?.stores?.name,
          position: employee.position,
          isActive: employee.is_active
        }
        
        // 직원이 비활성화된 경우
        if (!employee.is_active) {
          console.warn('[Auth] Inactive employee tried to access:', user.email)
          return null
        }
        
        // 매장이 비활성화된 경우
        if ((employee as any)?.stores && !(employee as any).stores.is_active) {
          console.warn('[Auth] Employee from inactive store tried to access:', user.email)
          return null
        }
      } else if (employeeError) {
        console.error('[Auth] Employee fetch error:', employeeError)
      }
    }
    
    // 5. 통합된 사용자 정보 반환
    return {
      id: user.id,
      email: profile.email,
      role: profile.role as UserRole,
      fullName: profile.full_name,
      ...employeeInfo
    }
  } catch (error) {
    console.error('[Auth] Unexpected error in getCachedAuthUser:', error)
    return null
  }
})

/**
 * 인증된 사용자 정보 가져오기 (인증 필수)
 * 인증되지 않은 경우 로그인 페이지로 리다이렉트
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCachedAuthUser()
  
  if (!user) {
    redirect('/login')
  }
  
  return user
}

/**
 * 특정 역할이 필요한 경우 사용
 * 권한이 없으면 대시보드로 리다이렉트
 */
export async function requireRole(requiredRoles: UserRole[]): Promise<AuthUser> {
  const user = await requireAuth()
  
  if (!requiredRoles.includes(user.role)) {
    console.warn(`[Auth] Role mismatch: ${user.role} not in [${requiredRoles.join(', ')}]`)
    redirect('/dashboard')
  }
  
  return user
}

/**
 * 페이지별 접근 권한 체크
 * 권한이 없으면 대시보드로 리다이렉트
 */
export async function checkPageAccess(pathname: string): Promise<AuthUser> {
  const user = await requireAuth()
  
  // super_admin은 모든 페이지 접근 가능
  if (user.role === 'super_admin') {
    return user
  }
  
  // 페이지별 권한 체크
  const pathKey = Object.keys(PAGE_ACCESS).find(path => 
    pathname.startsWith(path)
  ) as keyof typeof PAGE_ACCESS
  
  if (pathKey) {
    const allowedRoles = PAGE_ACCESS[pathKey] as readonly UserRole[]
    if (!allowedRoles.includes(user.role)) {
      console.warn(`[Auth] Access denied: ${user.role} tried to access ${pathname}`)
      redirect('/dashboard')
    }
  }
  
  return user
}

/**
 * 매장별 접근 권한 체크
 * 매니저는 자신의 매장 데이터만 접근 가능
 */
export async function checkStoreAccess(targetStoreId: string): Promise<AuthUser> {
  const user = await requireAuth()
  
  // super_admin과 admin은 모든 매장 접근 가능
  if (user.role === 'super_admin' || user.role === 'admin') {
    return user
  }
  
  // 매니저와 직원은 자신의 매장만 접근 가능
  if (user.storeId && user.storeId !== targetStoreId) {
    console.warn(`[Auth] Store access denied: ${user.role} tried to access store ${targetStoreId}`)
    redirect('/dashboard')
  }
  
  return user
}

/**
 * API 라우트용 인증 체크 (리다이렉트 없음)
 */
export async function getAuthUserForAPI(): Promise<AuthUser> {
  const user = await getCachedAuthUser()
  
  if (!user) {
    throw new AuthenticationError('Authentication required', 'UNAUTHENTICATED')
  }
  
  if (!user.isActive) {
    throw new AuthenticationError('User account is inactive', 'INACTIVE_USER')
  }
  
  return user
}

/**
 * 클라이언트 컴포넌트용 세션 체크
 * Server Action으로 사용
 */
export async function checkSession() {
  'use server'
  
  try {
    const user = await getCachedAuthUser()
    return {
      isAuthenticated: !!user,
      user: user ? {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        storeId: user.storeId,
        storeName: user.storeName
      } : null
    }
  } catch {
    return {
      isAuthenticated: false,
      user: null
    }
  }
}

/**
 * 로그아웃 처리
 */
export async function signOut() {
  'use server'
  
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}