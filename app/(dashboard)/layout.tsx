import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server-admin'
import { Sidebar } from '@/components/layouts/sidebar'
import { MobileNav } from '@/components/layouts/mobile-nav'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Service Role Key를 사용하여 RLS 우회하고 프로필 가져오기
  let userRole = 'employee'
  try {
    const adminClient = createAdminClient()
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    userRole = profile?.role || 'employee'
    console.log('[Layout] User role:', userRole)
  } catch (error) {
    console.error('[Layout] Error fetching role:', error)
    // 폴백: 일반 클라이언트로 시도
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    userRole = profile?.role || 'employee'
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar initialRole={userRole} />
      <MobileNav initialRole={userRole} />
      <main className="flex-1 overflow-y-auto lg:ml-0 pt-14 lg:pt-0 pb-16 lg:pb-0">
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}