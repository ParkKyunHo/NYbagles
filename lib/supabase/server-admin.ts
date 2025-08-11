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
    throw new Error('Missing SUPABASE_SERVICE_KEY environment variable. Please set it in Vercel dashboard.')
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