import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

/**
 * Create a Supabase client with admin privileges
 * Uses service role key to bypass RLS
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  
  if (!supabaseUrl) {
    console.error('[Admin Client] Missing NEXT_PUBLIC_SUPABASE_URL')
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
  }
  
  // In production (Vercel), we need the service key
  // During build time or development, we can use a fallback
  if (!supabaseServiceKey) {
    // Only log detailed info in development
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Admin Client] Service key not found, using fallback for development')
    }
    
    // Use the anon key as fallback for build time
    // This allows the build to succeed but will need proper key at runtime
    const fallbackKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!fallbackKey) {
      throw new Error('Missing both SUPABASE_SERVICE_ROLE_KEY and fallback NEXT_PUBLIC_SUPABASE_ANON_KEY')
    }
    
    // Create client with anon key (limited permissions)
    // This is okay for build time but will have limited access at runtime
    return createSupabaseClient<Database>(supabaseUrl, fallbackKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          'x-supabase-admin-fallback': 'true'
        }
      }
    })
  }
  
  // Create the admin client with service role key
  try {
    const client = createSupabaseClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          'x-supabase-service-role': 'true'
        }
      }
    })
    
    return client
  } catch (error) {
    console.error('[Admin Client] Failed to create client:', error)
    throw error
  }
}

/**
 * Create admin client with error recovery
 * Falls back to regular client if admin client fails
 */
export function createSafeAdminClient() {
  try {
    return createAdminClient()
  } catch (error) {
    console.warn('[Admin Client] Falling back to regular client due to:', error)
    // Fall back to creating a regular client if admin fails
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    
    return createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  }
}