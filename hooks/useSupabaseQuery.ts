import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UseSupabaseQueryOptions<T> {
  enabled?: boolean
  refetchInterval?: number
  onSuccess?: (data: T) => void
  onError?: (error: Error) => void
}

export function useSupabaseQuery<T = any>(
  queryFn: (supabase: ReturnType<typeof createClient>) => Promise<T>,
  dependencies: any[] = [],
  options?: UseSupabaseQueryOptions<T>
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  
  const supabase = createClient()
  const { enabled = true, refetchInterval, onSuccess, onError } = options || {}

  const executeQuery = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      const result = await queryFn(supabase)
      setData(result)
      
      if (onSuccess) {
        onSuccess(result)
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('쿼리 실행 중 오류가 발생했습니다.')
      setError(error)
      
      if (onError) {
        onError(error)
      }
    } finally {
      setLoading(false)
    }
  }, [supabase, queryFn, enabled, onSuccess, onError])

  useEffect(() => {
    executeQuery()

    // Set up refetch interval if specified
    if (refetchInterval && refetchInterval > 0) {
      const interval = setInterval(executeQuery, refetchInterval)
      return () => clearInterval(interval)
    }
  }, [...dependencies, executeQuery])

  const refetch = useCallback(() => {
    return executeQuery()
  }, [executeQuery])

  return {
    data,
    loading,
    error,
    refetch
  }
}

// 사용 예시:
// const { data: products, loading, error, refetch } = useSupabaseQuery(
//   async (supabase) => {
//     const { data, error } = await supabase
//       .from('products')
//       .select('*')
//       .eq('store_id', storeId)
//     
//     if (error) throw error
//     return data
//   },
//   [storeId],
//   {
//     enabled: !!storeId,
//     refetchInterval: 30000, // 30초마다 자동 갱신
//     onSuccess: (data) => console.log('Products loaded:', data),
//     onError: (error) => console.error('Error loading products:', error)
//   }
// )