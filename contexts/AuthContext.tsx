'use client'

import { createContext, useContext } from 'react'
import { UserRole } from '@/lib/auth/role-check'

export interface AuthContextValue {
  user: {
    id: string
    email: string
    role: UserRole
    fullName?: string
    storeId?: string
    storeName?: string
  }
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ 
  children, 
  value 
}: { 
  children: React.ReactNode
  value: AuthContextValue 
}) {
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}