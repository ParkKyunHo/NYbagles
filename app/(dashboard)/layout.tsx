import { getAuthUser } from '@/lib/auth/server-auth'
import { AuthProvider } from '@/contexts/AuthContext'
import { Sidebar } from '@/components/layouts/sidebar'
import { MobileNav } from '@/components/layouts/mobile-nav'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 통합된 인증 함수 사용
  const user = await getAuthUser()

  return (
    <AuthProvider value={{ user }}>
      <div className="flex h-screen bg-gray-100">
        <Sidebar initialRole={user.role} />
        <MobileNav initialRole={user.role} />
        <main className="flex-1 overflow-y-auto lg:ml-0 pt-14 lg:pt-0 pb-16 lg:pb-0">
          <div className="p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </AuthProvider>
  )
}