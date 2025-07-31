import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/supabase'

export function createClientWithAuth() {
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Ensure auth session is refreshed on client side
  supabase.auth.getSession().then(({ data: { session }, error }) => {
    if (error) {
      console.error('Error getting session:', error)
    }
  })

  return supabase
}