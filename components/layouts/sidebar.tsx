'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useLayoutEffect, useState } from 'react'
import { 
  Home, 
  Users, 
  ShoppingCart, 
  BarChart3, 
  FileText, 
  Settings,
  LogOut,
  QrCode,
  Clock,
  Shield,
  Store,
  UserCheck,
  Calendar,
  Package,
  DollarSign,
  UserPlus
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navigation = [
  { name: '대시보드', href: '/dashboard', icon: Home, roles: ['all'] },
  { name: 'QR 출퇴근', href: '/attendance', icon: QrCode, roles: ['all'] },
  { name: '스케줄 관리', href: '/schedule', icon: Calendar, roles: ['all'] },
  { name: '상품 관리', href: '/products', icon: Package, roles: ['super_admin', 'admin', 'manager'] },
  { name: '판매 입력', href: '/sales', icon: ShoppingCart, roles: ['all'] },
  { name: '판매 내역', href: '/sales/history', icon: FileText, roles: ['all'] },
  { name: '매출 요약', href: '/sales/summary', icon: BarChart3, roles: ['super_admin', 'admin', 'manager'] },
  { name: '직원 관리', href: '/dashboard/employees', icon: Users, roles: ['super_admin', 'admin', 'manager'] },
  { name: '근무 시간', href: '/dashboard/work-hours', icon: Clock, roles: ['all'] },
  { name: '급여 관리', href: '/dashboard/salary', icon: DollarSign, roles: ['super_admin', 'admin', 'manager'] },
  { name: '매출 분석', href: '/dashboard/analytics', icon: BarChart3, roles: ['super_admin', 'admin', 'manager'] },
  { name: '문서 관리', href: '/dashboard/documents', icon: FileText, roles: ['all'] },
  { name: '관리자', href: '/admin', icon: Shield, roles: ['super_admin', 'admin', 'manager'] },
  { name: '가입 승인', href: '/admin/signup-requests', icon: UserCheck, roles: ['super_admin', 'admin', 'manager'] },
  { name: '매장 관리', href: '/admin/stores', icon: Store, roles: ['super_admin', 'admin'] },
  { name: '설정', href: '/dashboard/settings', icon: Settings, roles: ['all'] },
]

interface SidebarProps {
  initialRole?: string
}

export function Sidebar({ initialRole }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [userRole, setUserRole] = useState<string | null>(initialRole || null)
  const [loading, setLoading] = useState(!initialRole)
  const [mounted, setMounted] = useState(false)

  // 컴포넌트가 마운트되었는지 확인
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    // initialRole이 이미 있으면 추가로 가져올 필요 없음
    if (initialRole) {
      return
    }

    if (!mounted) {
      return
    }
    
    const getUserRole = async () => {
      try {
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
      } catch (error) {
        console.error('Error in getUserRole:', error)
      } finally {
        setLoading(false)
      }
    }
    
    // 즉시 실행
    getUserRole()
    
    // auth state 변경 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      getUserRole()
    })
    
    return () => subscription.unsubscribe()
  }, [mounted, supabase, initialRole])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const filteredNavigation = navigation.filter(item => {
    if (item.roles.includes('all')) return true
    if (!userRole) return false
    return item.roles.includes(userRole)
  })
  

  if (loading) {
    return (
      <div className="hidden lg:flex h-full w-64 flex-col bg-bagel-black">
        <div className="flex h-16 items-center justify-center bg-bagel-yellow">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-bagel-black rounded-full flex items-center justify-center">
              <span className="text-bagel-yellow font-display text-lg font-bold">NY</span>
            </div>
            <h1 className="text-lg font-bold text-bagel-black">뉴욕러브 베이글</h1>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-bagel-yellow"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="hidden lg:flex h-full w-64 flex-col bg-bagel-black">
      <div className="flex h-16 items-center justify-center bg-bagel-yellow">
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 bg-bagel-black rounded-full flex items-center justify-center">
            <span className="text-bagel-yellow font-display text-lg font-bold">NY</span>
          </div>
          <h1 className="text-lg font-bold text-bagel-black">뉴욕러브 베이글</h1>
        </div>
      </div>
      
      <nav className="flex-1 space-y-1 px-2 py-4">
        {filteredNavigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors
                ${isActive 
                  ? 'bg-bagel-yellow text-bagel-black' 
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }
              `}
            >
              <item.icon
                className={`
                  mr-3 h-5 w-5 flex-shrink-0
                  ${isActive ? 'text-bagel-black' : 'text-gray-300 group-hover:text-white'}
                `}
              />
              {item.name}
            </Link>
          )
        })}
      </nav>
      
      <div className="border-t border-gray-800 p-4">
        <button
          onClick={handleLogout}
          className="group flex w-full items-center px-2 py-2 text-sm font-medium text-gray-200 rounded-md hover:bg-gray-800 hover:text-white transition-colors"
        >
          <LogOut className="mr-3 h-5 w-5 text-gray-300 group-hover:text-white" />
          로그아웃
        </button>
      </div>
    </div>
  )
}