import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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

  // 서버에서 프로필 정보 가져오기
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const userRole = profile?.role || 'employee'

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