'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UserRole, hasAccess, PAGE_ACCESS } from '@/lib/auth/role-check'

interface UseAuthCheckOptions {
  requiredRoles?: readonly UserRole[]
  redirectTo?: string
  allowedPaths?: string[]
}

export function useAuthCheck(options: UseAuthCheckOptions = {}) {
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [storeName, setStoreName] = useState<string>('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      // 1. 사용자 인증 확인 - 세션 복구 시도
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session) {
        // 세션이 없으면 로그인 페이지로
        console.log('No session found, redirecting to login')
        router.push('/login')
        return
      }
      
      const user = session.user
      if (!user) {
        console.log('No user in session, redirecting to login')
        router.push('/login')
        return
      }

      setUserId(user.id)

      // 2. 프로필에서 역할 가져오기 - 먼저 자신의 프로필만 조회
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', user.id)
        .single()

      if (profileError) {
        console.error('Profile fetch error:', profileError)
        // 프로필이 없으면 로그인 페이지로
        router.push('/login')
        return
      }

      const role = profile?.role as UserRole || 'employee'
      setUserRole(role)

      // 3. 권한 체크 (옵션이 제공된 경우)
      if (options.requiredRoles) {
        if (!hasAccess(role, options.requiredRoles)) {
          console.warn(`Access denied. User role: ${role}, Required: ${options.requiredRoles}`)
          router.push(options.redirectTo || '/dashboard')
          return
        }
      }

      // 4. 현재 경로에 대한 권한 체크
      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname
        const pathKey = Object.keys(PAGE_ACCESS).find(path => 
          currentPath.startsWith(path)
        )
        
        if (pathKey) {
          const allowedRoles = PAGE_ACCESS[pathKey as keyof typeof PAGE_ACCESS]
          if (!hasAccess(role, allowedRoles)) {
            console.warn(`Path access denied. Path: ${currentPath}, User role: ${role}`)
            router.push('/dashboard')
            return
          }
        }
      }

      // 5. 직원 정보 가져오기 (매장 정보 포함)
      const { data: employee } = await supabase
        .from('employees')
        .select('store_id, stores(id, name)')
        .eq('user_id', user.id)
        .single()

      if (employee?.store_id) {
        setStoreId(employee.store_id)
        setStoreName((employee as any).stores?.name || '')
      } else if (role === 'super_admin' || role === 'admin') {
        // 관리자인 경우 첫 번째 매장 가져오기
        const { data: firstStore } = await supabase
          .from('stores')
          .select('id, name')
          .eq('is_active', true)
          .limit(1)
          .single()

        if (firstStore) {
          setStoreId(firstStore.id)
          setStoreName(firstStore.name)
        }
      }

    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  return {
    loading,
    userRole,
    userId,
    storeId,
    storeName,
    checkAuth,
    isAuthenticated: !!userId,
    isManager: userRole ? ['super_admin', 'admin', 'manager'].includes(userRole) : false,
    isAdmin: userRole ? ['super_admin', 'admin'].includes(userRole) : false,
    isSuperAdmin: userRole === 'super_admin'
  }
}