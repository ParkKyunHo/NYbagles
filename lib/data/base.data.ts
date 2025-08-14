/**
 * 데이터 레이어 베이스 - Admin 클라이언트 표준화
 * 모든 데이터 페칭 모듈의 기반이 되는 공통 패턴
 */

import { createAdminClient, createSafeAdminClient } from '@/lib/supabase/server-admin'
import { unstable_cache } from 'next/cache'
import { serializeRows } from '@/lib/utils/serialization'

export interface DataFetchOptions {
  tags?: string[]
  revalidate?: number
  serialize?: boolean
}

/**
 * 표준화된 데이터 페칭 함수
 * Admin 클라이언트 사용, 캐싱, 직렬화 통합
 */
export async function fetchData<T>(
  queryFn: (client: ReturnType<typeof createAdminClient>) => Promise<any>,
  options: DataFetchOptions = {}
) {
  const { tags = [], revalidate = 60, serialize = true } = options
  
  const fetchFn = async () => {
    const adminClient = createSafeAdminClient()
    const result = await queryFn(adminClient)
    
    // PostgrestResponse 형태 처리
    if ('data' in result && 'error' in result) {
      const { data, error } = result
      
      if (error) {
        console.error('[DataLayer] Query error:', error)
        throw new Error(error.message)
      }
      
      if (!data) return null
      
      // 직렬화 옵션에 따라 처리
      return serialize ? serializeRows(data as any) : data
    }
    
    // 직접 데이터 반환하는 경우
    return serialize ? serializeRows(result as any) : result
  }
  
  // 캐싱 적용
  if (tags.length > 0) {
    return unstable_cache(
      fetchFn,
      tags,
      { tags, revalidate }
    )()
  }
  
  return fetchFn()
}

/**
 * 병렬 데이터 페칭 헬퍼
 * 여러 쿼리를 동시에 실행하여 성능 최적화
 */
export async function fetchParallel<T extends Record<string, any>>(
  queries: Record<string, () => Promise<any>>
): Promise<T> {
  const keys = Object.keys(queries)
  const promises = keys.map(key => queries[key]())
  const results = await Promise.all(promises)
  
  return keys.reduce((acc, key, index) => {
    (acc as any)[key] = results[index]
    return acc
  }, {} as T)
}

/**
 * 조직별 데이터 페칭 헬퍼
 * 멀티테넌트 환경에서 조직 격리 보장
 */
export async function fetchOrgData<T>(
  orgId: string,
  tableName: string,
  selectQuery: string = '*',
  options: DataFetchOptions = {}
) {
  return fetchData<T>(
    async (client) => {
      return await client
        .from(tableName)
        .select(selectQuery)
        .eq('org_id', orgId)
    },
    { 
      ...options, 
      tags: [...(options.tags || []), `org-${orgId}`, tableName] 
    }
  )
}

/**
 * 에러 핸들링 래퍼
 * 일관된 에러 처리 및 로깅
 */
export async function safeDataFetch<T>(
  fetchFn: () => Promise<T>,
  fallback: T,
  context?: string
): Promise<T> {
  try {
    return await fetchFn()
  } catch (error) {
    console.error(`[DataLayer${context ? `:${context}` : ''}] Error:`, error)
    return fallback
  }
}