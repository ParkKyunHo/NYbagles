import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

interface Profile {
  id: string
  role: string
  full_name?: string
  email?: string
}

interface UseAuthOptions {
  redirectTo?: string
  requiredRole?: string | string[]
}

export function useAuth(options?: UseAuthOptions) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !user) {
          if (options?.redirectTo) {
            router.push(options.redirectTo)
          }
          setLoading(false)
          return
        }

        setUser(user)

        // Fetch profile if user exists
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (profileError) {
          setError('프로필을 불러올 수 없습니다.')
          setLoading(false)
          return
        }

        setProfile(profileData)

        // Check role requirements
        if (options?.requiredRole) {
          const requiredRoles = Array.isArray(options.requiredRole) 
            ? options.requiredRole 
            : [options.requiredRole]
          
          if (!requiredRoles.includes(profileData.role)) {
            router.push('/dashboard')
            return
          }
        }

        setLoading(false)
      } catch (err) {
        setError('인증 확인 중 오류가 발생했습니다.')
        setLoading(false)
      }
    }

    checkAuth()

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          if (options?.redirectTo) {
            router.push(options.redirectTo)
          }
        } else if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user)
          // Re-fetch profile on sign in
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()
          
          if (profileData) {
            setProfile(profileData)
          }
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [router, supabase, options?.redirectTo, options?.requiredRole])

  return {
    user,
    profile,
    loading,
    error,
    isAuthenticated: !!user,
    hasRole: (role: string | string[]) => {
      if (!profile) return false
      const roles = Array.isArray(role) ? role : [role]
      return roles.includes(profile.role)
    }
  }
}