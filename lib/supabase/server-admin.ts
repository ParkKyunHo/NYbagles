import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  
  // 디버깅을 위한 환경 변수 상태 로깅
  console.log('[Admin Client] Environment check:', {
    hasUrl: !!supabaseUrl,
    urlLength: supabaseUrl?.length || 0,
    hasServiceKey: !!supabaseServiceKey,
    keyLength: supabaseServiceKey?.length || 0,
    keyPrefix: supabaseServiceKey?.substring(0, 20) || 'not-set',
    nodeEnv: process.env.NODE_ENV,
    isVercel: !!process.env.VERCEL
  })
  
  if (!supabaseUrl) {
    console.error('[Admin Client] Missing NEXT_PUBLIC_SUPABASE_URL')
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
  }
  
  if (!supabaseServiceKey) {
    console.error('[Admin Client] Missing SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY')
    console.error('[Admin Client] Available env vars:', Object.keys(process.env).filter(k => k.includes('SUPABASE')))
    
    // 빌드 시점에는 환경변수가 없을 수 있으므로 더미 값 사용
    if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
      throw new Error('Missing SUPABASE_SERVICE_KEY environment variable. Please set it in Vercel dashboard.')
    }
    
    // 빌드용 더미 키 사용
    console.warn('[Admin Client] Using dummy key for build process')
    const dummyKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
    return createSupabaseClient(supabaseUrl, dummyKey, {
      db: { schema: 'public' },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  }
  
  try {
    const client = createSupabaseClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    
    console.log('[Admin Client] Successfully created admin client')
    return client
  } catch (error) {
    console.error('[Admin Client] Failed to create client:', error)
    throw error
  }
}