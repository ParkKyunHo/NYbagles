import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/supabase'

// Singleton instance to maintain session consistency
let supabaseClient: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createClient() {
  // Return existing client if available
  if (supabaseClient) {
    return supabaseClient
  }
  
  // Create new client with proper cookie handling
  supabaseClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          if (typeof document !== 'undefined') {
            const cookies = document.cookie.split('; ')
            const cookie = cookies.find(c => c.startsWith(`${name}=`))
            return cookie ? decodeURIComponent(cookie.split('=')[1]) : undefined
          }
          return undefined
        },
        set(name: string, value: string, options?: any) {
          if (typeof document !== 'undefined') {
            let cookieString = `${name}=${encodeURIComponent(value)}`
            
            if (options?.maxAge) {
              cookieString += `; Max-Age=${options.maxAge}`
            }
            if (options?.path) {
              cookieString += `; Path=${options.path || '/'}`
            }
            if (options?.domain) {
              cookieString += `; Domain=${options.domain}`
            }
            if (options?.sameSite) {
              cookieString += `; SameSite=${options.sameSite}`
            }
            if (options?.secure) {
              cookieString += `; Secure`
            }
            
            document.cookie = cookieString
          }
        },
        remove(name: string, options?: any) {
          if (typeof document !== 'undefined') {
            let cookieString = `${name}=; Max-Age=0`
            
            if (options?.path) {
              cookieString += `; Path=${options.path || '/'}`
            }
            if (options?.domain) {
              cookieString += `; Domain=${options.domain}`
            }
            
            document.cookie = cookieString
          }
        },
      },
      auth: {
        persistSession: true,
        storageKey: 'supabase.auth.token',
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        detectSessionInUrl: true,
        autoRefreshToken: true,
        flowType: 'pkce'
      }
    }
  )
  
  return supabaseClient
}