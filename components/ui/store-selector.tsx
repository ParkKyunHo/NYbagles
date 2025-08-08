'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Store } from 'lucide-react'

interface Region {
  name: string
}

interface StoreCategory {
  name: string
  regions?: Region | Region[]
}

interface Store {
  id: string
  name: string
  store_categories?: StoreCategory | StoreCategory[]
}

interface StoreSelectorProps {
  selectedStoreId?: string | null
  value?: string | null  // Support both prop names
  onStoreChange?: (storeId: string, storeName: string) => void
  onChange?: (storeId: string, storeName: string) => void  // Support both prop names
  userRole?: string
  className?: string
  showAll?: boolean  // 전체 매장 옵션 표시 여부
  allLabel?: string  // 전체 매장 라벨
}

export function StoreSelector({ 
  selectedStoreId, 
  value,
  onStoreChange, 
  onChange,
  userRole = '',
  className = '',
  showAll = false,
  allLabel = '전체'
}: StoreSelectorProps) {
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchStores = async () => {
      try {
        const { data, error } = await supabase
          .from('stores')
          .select(`
            id,
            name,
            store_categories!inner (
              name,
              regions!inner (
                name
              )
            )
          `)
          .eq('is_active', true)
          .order('name')

        if (error) {
          console.error('Error fetching stores:', error)
        } else {
          setStores(data || [])
        }
      } catch (error) {
        console.error('Error fetching stores:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStores()
  }, [supabase])

  // Only show selector for admin and super_admin
  // Managers can see their own store, so don't need selector
  if (!['super_admin', 'admin'].includes(userRole)) {
    return null
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Store className="h-5 w-5 text-black" />
      <label htmlFor="store-select" className="text-sm font-medium text-black">
        매장 선택:
      </label>
      <select
        id="store-select"
        value={selectedStoreId || value || ''}
        onChange={(e) => {
          if (e.target.value === '' && showAll) {
            // 전체 매장 선택
            const handleChange = onChange || onStoreChange
            if (handleChange) {
              handleChange('', allLabel)
            }
          } else {
            const store = stores.find(s => s.id === e.target.value)
            if (store) {
              const handleChange = onChange || onStoreChange
              if (handleChange) {
                handleChange(store.id, store.name)
              }
            }
          }
        }}
        disabled={loading}
        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow"
      >
        {loading ? (
          <option value="">로딩 중...</option>
        ) : (
          <>
            <option value="">{showAll ? allLabel : '매장을 선택하세요'}</option>
            {stores.map((store) => {
              const category = Array.isArray(store.store_categories) 
                ? store.store_categories[0] 
                : store.store_categories;
              
              const region = category?.regions && (
                Array.isArray(category.regions) 
                  ? category.regions[0]?.name 
                  : category.regions?.name
              );
              
              return (
                <option key={store.id} value={store.id}>
                  {store.name} - {region} {category?.name}
                </option>
              );
            })}
          </>
        )}
      </select>
    </div>
  )
}