'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, Home, QrCode, Clock, Settings, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface MobileNavProps {
  initialRole?: string
}

export function MobileNav({ initialRole }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const navigation = [
    { name: '홈', href: '/dashboard', icon: Home },
    { name: 'QR 스캔', href: '/dashboard/attendance/scan', icon: QrCode },
    { name: '출퇴근', href: '/dashboard/attendance', icon: Clock },
    { name: '설정', href: '/dashboard/settings', icon: Settings },
  ]

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    setIsOpen(false)
  }

  return (
    <div className="lg:hidden">
      {/* 모바일 헤더 */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-bagel-yellow shadow-md">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-bagel-black rounded-full flex items-center justify-center">
              <span className="text-bagel-yellow font-display text-sm font-bold">NY</span>
            </div>
            <span className="text-bagel-black font-bold text-lg">뉴욕러브 베이글</span>
          </Link>
          
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 rounded-md text-bagel-black hover:bg-bagel-yellow-600 focus:outline-none"
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* 모바일 메뉴 오버레이 */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black bg-opacity-50"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* 모바일 메뉴 */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-40 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="px-4 py-5 bg-bagel-yellow">
            <h2 className="text-xl font-bold text-bagel-black">메뉴</h2>
          </div>
          
          <nav className="flex-1 px-4 py-4">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`
                    flex items-center px-3 py-3 mb-2 text-sm font-medium rounded-lg transition-colors
                    ${isActive 
                      ? 'bg-bagel-yellow text-bagel-black' 
                      : 'text-gray-700 hover:bg-bagel-yellow-100'
                    }
                  `}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </nav>
          
          <div className="border-t border-gray-200 px-4 py-4">
            <button
              onClick={handleLogout}
              className="flex w-full items-center px-3 py-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100"
            >
              <LogOut className="mr-3 h-5 w-5" />
              로그아웃
            </button>
          </div>
        </div>
      </div>

      {/* 하단 탭 바 (모바일) */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200">
        <div className="grid grid-cols-4 py-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`
                  flex flex-col items-center justify-center py-2
                  ${isActive ? 'text-bagel-yellow-600' : 'text-gray-600'}
                `}
              >
                <item.icon className="h-5 w-5 mb-1" />
                <span className="text-xs font-medium">{item.name}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}