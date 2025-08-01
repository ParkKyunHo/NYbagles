import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'

interface Store {
  id: string
  name: string
  code: string
  address?: string
  phone?: string
  region?: string
  category?: string
}

export function useStore() {
  const [stores, setStores] = useState<Store[]>([])
  const [currentStore, setCurrentStore] = useState<Store | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const { user, profile } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    if (!user || !profile) {
      setLoading(false)
      return
    }

    const fetchStores = async () => {
      try {
        // Admin and super_admin can see all stores
        if (profile.role === 'super_admin' || profile.role === 'admin') {
          const { data, error } = await supabase
            .from('stores')
            .select(`
              *,
              store_categories (
                name,
                regions (
                  name
                )
              )
            `)
            .eq('is_active', true)
            .order('name')

          if (error) throw error

          const formattedStores = data?.map(store => ({
            id: store.id,
            name: store.name,
            code: store.code,
            address: store.address,
            phone: store.phone,
            region: store.store_categories?.regions?.name,
            category: store.store_categories?.name
          })) || []

          setStores(formattedStores)
          
          // Set the first store as current if not already set
          if (formattedStores.length > 0 && !currentStore) {
            setCurrentStore(formattedStores[0])
          }
        } else {
          // Other users only see their assigned store
          const { data: employee } = await supabase
            .from('employees')
            .select(`
              store_id,
              stores (
                *,
                store_categories (
                  name,
                  regions (
                    name
                  )
                )
              )
            `)
            .eq('user_id', user.id)
            .single()

          if (employee?.stores) {
            const store = {
              id: employee.stores.id,
              name: employee.stores.name,
              code: employee.stores.code,
              address: employee.stores.address,
              phone: employee.stores.phone,
              region: employee.stores.store_categories?.regions?.name,
              category: employee.stores.store_categories?.name
            }
            setStores([store])
            setCurrentStore(store)
          }
        }

        setLoading(false)
      } catch (err) {
        console.error('Error fetching stores:', err)
        setError('매장 정보를 불러올 수 없습니다.')
        setLoading(false)
      }
    }

    fetchStores()
  }, [user, profile, supabase, currentStore])

  const changeStore = (storeId: string) => {
    const store = stores.find(s => s.id === storeId)
    if (store) {
      setCurrentStore(store)
      // 로컬 스토리지에 저장하여 새로고침 후에도 유지
      localStorage.setItem('selectedStoreId', storeId)
    }
  }

  // 로컬 스토리지에서 선택된 매장 복원
  useEffect(() => {
    const savedStoreId = localStorage.getItem('selectedStoreId')
    if (savedStoreId && stores.length > 0) {
      const store = stores.find(s => s.id === savedStoreId)
      if (store) {
        setCurrentStore(store)
      }
    }
  }, [stores])

  return {
    stores,
    currentStore,
    loading,
    error,
    changeStore,
    canSelectStore: profile?.role === 'super_admin' || profile?.role === 'admin'
  }
}