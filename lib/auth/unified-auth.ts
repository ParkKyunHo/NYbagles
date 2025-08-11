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
  organizationId?: string
  organizationName?: string
  storeId?: string  // Legacy support
  storeName?: string  // Legacy support
  employeeId?: string
  position?: string
  isActive: boolean
  isApproved: boolean
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
    let adminClient
    let usingAdminClient = true
    
    try {
      adminClient = createAdminClient()
      console.log('[Auth] Admin client created successfully')
    } catch (error) {
      console.error('[Auth] Failed to create admin client, falling back to regular client:', error)
      usingAdminClient = false
      adminClient = supabase // Fallback to regular client
    }
    
    // 3. 사용자 설정 및 현재 조직 가져오기
    console.log('[Auth] Fetching user settings and organization for user:', user.id)
    
    const { data: userSettings } = await adminClient
      .from('user_settings')
      .select('active_org_id')
      .eq('user_id', user.id)
      .single()
    
    const activeOrgId = userSettings?.active_org_id
    
    // 4. 멤버십 정보 가져오기 (프로필 포함)
    let membershipQuery = adminClient
      .from('memberships')
      .select(`
        org_id,
        role,
        approved_at,
        organizations (
          id,
          name,
          legacy_store_id
        ),
        profiles:user_id (
          id,
          email,
          full_name
        )
      `)
      .eq('user_id', user.id)
    
    // 활성 조직이 있으면 해당 조직의 멤버십만 가져오기
    if (activeOrgId) {
      membershipQuery = membershipQuery.eq('org_id', activeOrgId)
    }
    
    const { data: memberships, error: membershipError } = await membershipQuery
    
    if (membershipError) {
      console.error('[Auth] Membership fetch error:', {
        error: membershipError,
        userId: user.id,
        errorCode: membershipError.code,
        errorMessage: membershipError.message
      })
      return null
    }
    
    // 승인된 멤버십 찾기
    const activeMembership = memberships?.find(m => m.approved_at !== null)
    
    if (!activeMembership) {
      console.log('[Auth] No approved membership found for user:', user.id)
      return null
    }
    
    // 프로필 정보 추출
    const profile = (activeMembership as any).profiles
    const organization = (activeMembership as any).organizations
    
    console.log('[Auth] Membership fetched successfully:', {
      userId: user.id,
      role: activeMembership.role,
      organizationId: organization?.id,
      isApproved: !!activeMembership.approved_at
    })
    
    // 5. Legacy support: 직원 정보 가져오기 (기존 시스템 호환성)
    let employeeInfo = {
      employeeId: undefined as string | undefined,
      storeId: organization?.legacy_store_id || undefined,
      storeName: undefined as string | undefined,
      position: undefined as string | undefined,
      isActive: true
    }
    
    // Legacy store 정보가 있으면 추가 정보 가져오기
    if (organization?.legacy_store_id) {
      const { data: employee } = await adminClient
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
        console.log('[Auth] Legacy employee record found:', {
          employeeId: employee.id,
          storeId: employee.store_id,
          isActive: employee.is_active
        })
        
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
      }
    }
    
    // 6. 통합된 사용자 정보 반환
    return {
      id: user.id,
      email: profile?.email || user.email || '',
      role: activeMembership.role as UserRole,
      fullName: profile?.full_name,
      organizationId: organization?.id,
      organizationName: organization?.name,
      isApproved: !!activeMembership.approved_at,
      ...employeeInfo
    }
  } catch (error) {
    console.error('[Auth] Unexpected error in getCachedAuthUser:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
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
 * 조직별 접근 권한 체크
 * 사용자는 자신이 속한 조직 데이터만 접근 가능
 */
export async function checkOrganizationAccess(targetOrgId: string): Promise<AuthUser> {
  const user = await requireAuth()
  
  // super_admin은 모든 조직 접근 가능
  if (user.role === 'super_admin') {
    return user
  }
  
  // 사용자가 속한 조직인지 확인
  if (user.organizationId && user.organizationId !== targetOrgId) {
    console.warn(`[Auth] Organization access denied: ${user.role} tried to access org ${targetOrgId}`)
    redirect('/dashboard')
  }
  
  return user
}

/**
 * 매장별 접근 권한 체크 (Legacy support)
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
        organizationId: user.organizationId,
        organizationName: user.organizationName,
        storeId: user.storeId,
        storeName: user.storeName,
        isApproved: user.isApproved
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
 * 현재 조직 변경
 */
export async function switchOrganization(newOrgId: string) {
  'use server'
  
  const user = await requireAuth()
  const adminClient = createAdminClient()
  
  // 사용자가 해당 조직의 멤버인지 확인
  const { data: membership } = await adminClient
    .from('memberships')
    .select('*')
    .eq('user_id', user.id)
    .eq('org_id', newOrgId)
    .eq('approved_at', 'not.null')
    .single()
  
  if (!membership) {
    throw new Error('해당 조직의 멤버가 아닙니다')
  }
  
  // user_settings 업데이트
  await adminClient
    .from('user_settings')
    .upsert({
      user_id: user.id,
      active_org_id: newOrgId,
      updated_at: new Date().toISOString()
    })
  
  // 감사 로그 기록
  await adminClient
    .from('audit_log')
    .insert({
      actor: user.id,
      org_id: newOrgId,
      action: 'switch_organization',
      table_name: 'user_settings',
      details: {
        from_org: user.organizationId,
        to_org: newOrgId
      }
    })
  
  redirect('/dashboard')
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