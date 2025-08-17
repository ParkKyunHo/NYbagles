'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Menu, 
  X, 
  Home, 
  QrCode, 
  Clock, 
  Settings, 
  LogOut,
  Users, 
  ShoppingCart, 
  BarChart3, 
  FileText,
  UserCheck,
  Calendar,
  Package,
  DollarSign,
  Shield,
  Store,
  ScanLine
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface MobileNavProps {
  initialRole?: string
}

export function MobileNav({ initialRole }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(initialRole || null)
  const [loading, setLoading] = useState(!initialRole)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  // Complete navigation items matching desktop sidebar
  const allNavigation = [
    { name: '홈', href: '/dashboard', icon: Home, roles: ['all'] },
    { name: 'QR 출퇴근', href: '/attendance', icon: QrCode, roles: ['all'] },
    { name: 'QR 스캔', href: '/attendance/scan', icon: QrCode, roles: ['all'], quickAccess: true },
    { name: '스케줄 관리', href: '/schedule', icon: Calendar, roles: ['all'] },
    { name: 'QR 매출 조회', href: '/qr-sales', icon: ScanLine, roles: ['super_admin', 'admin'] },
    { name: '상품 승인', href: '/products/approvals', icon: UserCheck, roles: ['super_admin', 'admin'] },
    { name: '일일 마감', href: '/sales/closing', icon: Calendar, roles: ['super_admin', 'admin', 'manager'] },
    { name: '상품 관리', href: '/products', icon: Package, roles: ['super_admin', 'admin', 'manager'] },
    { name: '판매 입력', href: '/sales', icon: ShoppingCart, roles: ['super_admin', 'admin', 'manager'] },
    { name: '판매 내역', href: '/sales/history', icon: FileText, roles: ['super_admin', 'admin', 'manager'] },
    { name: '매출 요약', href: '/sales/summary', icon: BarChart3, roles: ['super_admin', 'admin', 'manager'] },
    { name: '직원 관리', href: '/dashboard/employees', icon: Users, roles: ['super_admin', 'admin'] },
    { name: '근무 시간', href: '/dashboard/work-hours', icon: Clock, roles: ['all'] },
    { name: '급여 관리', href: '/dashboard/salary', icon: DollarSign, roles: ['super_admin', 'admin', 'manager'] },
    { name: '매출 분석', href: '/dashboard/analytics', icon: BarChart3, roles: ['super_admin', 'admin', 'manager'] },
    { name: '문서 관리', href: '/dashboard/documents', icon: FileText, roles: ['all'] },
    { name: '관리자', href: '/admin', icon: Shield, roles: ['super_admin', 'admin'] },
    { name: '가입 승인', href: '/admin/signup-requests', icon: UserCheck, roles: ['super_admin', 'admin'] },
    { name: '매장 관리', href: '/admin/stores', icon: Store, roles: ['super_admin', 'admin'] },
    { name: '설정', href: '/dashboard/settings', icon: Settings, roles: ['all'] },
  ]

  // Quick access items for bottom tab bar
  const quickNavigation = [
    { name: '홈', href: '/dashboard', icon: Home },
    { name: 'QR 스캔', href: '/attendance/scan', icon: QrCode },
    { name: '출퇴근', href: '/attendance', icon: Clock },
    { name: '설정', href: '/dashboard/settings', icon: Settings },
  ]

  useEffect(() => {
    if (initialRole) {
      setUserRole(initialRole)
      setLoading(false)
      return
    }
    
    const getUserRole = async () => {
      try {
        const response = await fetch('/api/auth/user-role')
        
        if (response.ok) {
          const data = await response.json()
          setUserRole(data.role)
        } else {
          const { data: { user } } = await supabase.auth.getUser()
          
          if (user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', user.id)
              .single()
            
            if (profile) {
              setUserRole(profile.role)
            } else {
              setUserRole('employee')
            }
          }
        }
      } catch (error) {
        console.error('[MobileNav] Error fetching role:', error)
        setUserRole('employee')
      } finally {
        setLoading(false)
      }
    }
    
    getUserRole()
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      getUserRole()
    })
    
    return () => subscription.unsubscribe()
  }, [initialRole, supabase])

  const filteredNavigation = allNavigation.filter(item => {
    if (item.roles.includes('all')) return true
    if (!userRole) return false
    return item.roles.includes(userRole)
  })

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    setIsOpen(false)
  }

  if (loading) {
    return (
      <div className="lg:hidden">
        <div className="fixed top-0 left-0 right-0 z-40 bg-bagel-yellow shadow-md">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-bagel-black rounded-full flex items-center justify-center">
                <span className="text-bagel-yellow font-display text-sm font-bold">NY</span>
              </div>
              <span className="text-bagel-black font-bold text-lg">뉴욕러브 베이글</span>
            </div>
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-bagel-black"></div>
          </div>
        </div>
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200">
          <div className="grid grid-cols-4 py-2">
            {quickNavigation.map((item) => (
              <div key={item.name} className="flex flex-col items-center justify-center py-2 opacity-50">
                <item.icon className="h-5 w-5 mb-1" />
                <span className="text-xs font-medium">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="lg:hidden">
      {/* Enhanced Mobile Header */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-bagel-yellow shadow-md">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="flex items-center space-x-2 min-w-0 flex-1">
            <div className="w-8 h-8 bg-bagel-black rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-bagel-yellow font-display text-sm font-bold">NY</span>
            </div>
            <span className="text-bagel-black font-bold text-base sm:text-lg truncate">뉴욕러브 베이글</span>
          </Link>
          
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 rounded-md text-bagel-black hover:bg-bagel-yellow-600 focus:outline-none focus:ring-2 focus:ring-bagel-black focus:ring-opacity-50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label={isOpen ? '메뉴 닫기' : '메뉴 열기'}
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Enhanced Mobile Menu Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black bg-opacity-50 transition-opacity duration-300 ease-in-out"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Enhanced Mobile Menu Drawer */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-50 w-80 max-w-[85vw] bg-white shadow-xl transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="px-4 py-5 bg-bagel-yellow border-b border-bagel-yellow-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-bagel-black">메뉴</h2>
              <span className="text-sm text-bagel-black opacity-75 capitalize">
                {userRole === 'super_admin' ? '최고관리자' : 
                 userRole === 'admin' ? '관리자' : 
                 userRole === 'manager' ? '매니저' : '직원'}
              </span>
            </div>
          </div>
          
          <nav className="flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-1">
              {filteredNavigation.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`
                      flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200
                      min-h-[44px] touch-manipulation
                      ${isActive 
                        ? 'bg-bagel-yellow text-bagel-black shadow-sm' 
                        : 'text-gray-700 hover:bg-bagel-yellow-100 hover:text-bagel-black active:bg-bagel-yellow-200'
                      }
                    `}
                  >
                    <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </Link>
                )
              })}
            </div>
          </nav>
          
          <div className="border-t border-gray-200 px-4 py-4">
            <button
              onClick={handleLogout}
              className="flex w-full items-center px-3 py-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-red-50 hover:text-red-600 transition-all duration-200 min-h-[44px] touch-manipulation"
            >
              <LogOut className="mr-3 h-5 w-5 flex-shrink-0" />
              로그아웃
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced Bottom Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 shadow-lg">
        <div className="grid grid-cols-4 py-1">
          {quickNavigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`
                  flex flex-col items-center justify-center py-2 px-1
                  min-h-[56px] touch-manipulation transition-all duration-200
                  ${isActive 
                    ? 'text-bagel-yellow-600 bg-bagel-yellow-50' 
                    : 'text-gray-600 hover:text-bagel-yellow-600 hover:bg-bagel-yellow-50 active:bg-bagel-yellow-100'
                  }
                `}
              >
                <item.icon className="h-5 w-5 mb-1 flex-shrink-0" />
                <span className="text-xs font-medium leading-tight text-center">{item.name}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}