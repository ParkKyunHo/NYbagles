import { createClient } from '@/lib/supabase/server'

export type UserRole = 'super_admin' | 'admin' | 'manager' | 'employee' | 'part_time'

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return null
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return profile
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

export async function requireRole(roles: UserRole[]) {
  const user = await requireAuth()
  if (!roles.includes(user.role as UserRole)) {
    throw new Error('Insufficient permissions')
  }
  return user
}

export async function canManageStore(storeId: string) {
  const user = await requireAuth()
  
  // Super admin can manage all stores
  if (user.role === 'super_admin') {
    return true
  }

  const supabase = await createClient()
  
  // Check if user has access to the store
  const { data: employee } = await supabase
    .from('employees')
    .select('store_id')
    .eq('user_id', user.id)
    .eq('store_id', storeId)
    .single()

  if (!employee) {
    return false
  }

  // Only managers and above can manage stores
  return ['admin', 'manager'].includes(user.role)
}