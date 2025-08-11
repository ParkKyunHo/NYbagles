import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

// Create a Supabase client with the service role key for admin operations
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  // 빌드 시점에는 더미 클라이언트 반환
  if (!supabaseUrl || !supabaseServiceKey) {
    // 빌드 시점에는 에러를 throw하지 않고 더미 클라이언트 반환
    if (typeof window === 'undefined') {
      console.warn('[Admin Client] Missing environment variables, using dummy client for build')
      const dummyUrl = 'https://dummy.supabase.co'
      const dummyKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
      
      return createClient<Database>(
        dummyUrl,
        dummyKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      )
    }
    
    // 런타임에는 에러 발생
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
  }
  
  return createClient<Database>(
    supabaseUrl,
    supabaseServiceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}