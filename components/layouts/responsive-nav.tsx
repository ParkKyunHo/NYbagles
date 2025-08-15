'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Menu,
  X,
  Home,
  Users,
  Package,
  ShoppingCart,
  Calendar,
  Clock,
  Settings,
  LogOut,
  ChevronDown,
  Bell,
  Search,
  User
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

interface NavItem {
  name: string
  href: string
  icon: React.ReactNode
  badge?: number
  children?: NavItem[]
}

interface ResponsiveNavProps {
  user: {
    id: string
    email: string
    fullName?: string
    role: string
    storeName?: string
  }
}

export function ResponsiveNav({ user }: ResponsiveNavProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const [notifications, setNotifications] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    // Check for pending approvals if admin
    if (['admin', 'super_admin'].includes(user.role)) {
      checkPendingApprovals()
    }

    // Close mobile menu on route change
    setIsMobileMenuOpen(false)
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  const checkPendingApprovals = async () => {
    const { count } = await supabase
      .from('employee_signup_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'verified')
    
    setNotifications(count || 0)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const toggleExpanded = (name: string) => {
    setExpandedItems(prev =>
      prev.includes(name)
        ? prev.filter(item => item !== name)
        : [...prev, name]
    )
  }

  const getNavItems = (): NavItem[] => {
    const baseItems: NavItem[] = [
      { name: '대시보드', href: '/dashboard', icon: <Home className="h-5 w-5" /> }
    ]

    switch (user.role) {
      case 'super_admin':
      case 'admin':
        return [
          ...baseItems,
          {
            name: '직원 관리',
            href: '/dashboard/employees',
            icon: <Users className="h-5 w-5" />,
            badge: notifications,
            children: [
              { name: '직원 목록', href: '/dashboard/employees', icon: <Users className="h-4 w-4" /> },
              { name: '가입 요청', href: '/dashboard/employee-requests', icon: <User className="h-4 w-4" />, badge: notifications },
              { name: '급여 관리', href: '/dashboard/salary', icon: <Package className="h-4 w-4" /> }
            ]
          },
          {
            name: '상품 관리',
            href: '/products',
            icon: <Package className="h-5 w-5" />,
            children: [
              { name: '상품 목록', href: '/products', icon: <Package className="h-4 w-4" /> },
              { name: '승인 대기', href: '/products/approvals', icon: <Clock className="h-4 w-4" /> },
              { name: '재고 관리', href: '/products/store', icon: <Package className="h-4 w-4" /> }
            ]
          },
          { name: '매출 관리', href: '/sales', icon: <ShoppingCart className="h-5 w-5" /> },
          { name: '일정 관리', href: '/schedule', icon: <Calendar className="h-5 w-5" /> },
          { name: '설정', href: '/dashboard/settings', icon: <Settings className="h-5 w-5" /> }
        ]
      case 'manager':
        return [
          ...baseItems,
          { name: '직원 정보', href: '/dashboard/employees', icon: <Users className="h-5 w-5" /> },
          { name: '판매 관리', href: '/sales/simple', icon: <ShoppingCart className="h-5 w-5" /> },
          { name: '재고 관리', href: '/products/store', icon: <Package className="h-5 w-5" /> },
          { name: '근태 관리', href: '/attendance', icon: <Clock className="h-5 w-5" /> },
          { name: '일정 관리', href: '/schedule', icon: <Calendar className="h-5 w-5" /> }
        ]
      default:
        return [
          ...baseItems,
          { name: '출퇴근', href: '/attendance/scan', icon: <Clock className="h-5 w-5" /> },
          { name: '근무 일정', href: '/schedule', icon: <Calendar className="h-5 w-5" /> },
          { name: '근무 시간', href: '/dashboard/work-hours', icon: <Clock className="h-5 w-5" /> },
          { name: '설정', href: '/dashboard/settings', icon: <Settings className="h-5 w-5" /> }
        ]
    }
  }

  const navItems = getNavItems()

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden lg:flex fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-40">
        <div className="flex items-center justify-between w-full px-6">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-bagel-yellow rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">N</span>
            </div>
            <span className="font-bold text-xl text-gray-900">NYbalges</span>
          </Link>

          {/* Search Bar */}
          <div className="flex-1 max-w-xl mx-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-bagel-yellow"
              />
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center space-x-4">
            {/* Notifications */}
            <button className="relative p-2 text-gray-600 hover:text-gray-900">
              <Bell className="h-5 w-5" />
              {notifications > 0 && (
                <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {notifications}
                </span>
              )}
            </button>

            {/* User Menu */}
            <div className="flex items-center space-x-3">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user.fullName || user.email}</p>
                <p className="text-xs text-gray-500">{user.storeName || user.role}</p>
              </div>
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <nav className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-40">
        <div className="flex items-center justify-between h-full px-4">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-bagel-yellow rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">N</span>
            </div>
            <span className="font-bold text-lg text-gray-900">NYbalges</span>
          </Link>

          <div className="flex items-center space-x-2">
            {notifications > 0 && (
              <button className="relative p-2">
                <Bell className="h-5 w-5 text-gray-600" />
                <span className="absolute top-0 right-0 h-3 w-3 bg-red-500 rounded-full" />
              </button>
            )}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6 text-gray-900" />
              ) : (
                <Menu className="h-6 w-6 text-gray-900" />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween' }}
            className="lg:hidden fixed inset-y-0 right-0 w-80 bg-white shadow-xl z-50 overflow-y-auto"
          >
            <div className="p-6">
              {/* User Info */}
              <div className="mb-6 pb-6 border-b">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-bagel-yellow rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-lg">
                      {user.fullName?.charAt(0) || user.email.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{user.fullName || user.email}</p>
                    <p className="text-sm text-gray-500">{user.storeName || user.role}</p>
                  </div>
                </div>
              </div>

              {/* Navigation Items */}
              <div className="space-y-1">
                {navItems.map((item) => (
                  <div key={item.name}>
                    {item.children ? (
                      <>
                        <button
                          onClick={() => toggleExpanded(item.name)}
                          className={`
                            w-full flex items-center justify-between px-3 py-2 rounded-lg
                            ${pathname === item.href ? 'bg-bagel-yellow/10 text-bagel-yellow' : 'text-gray-700 hover:bg-gray-100'}
                          `}
                        >
                          <div className="flex items-center space-x-3">
                            {item.icon}
                            <span className="font-medium">{item.name}</span>
                            {item.badge && item.badge > 0 && (
                              <span className="ml-2 px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${
                              expandedItems.includes(item.name) ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                        <AnimatePresence>
                          {expandedItems.includes(item.name) && (
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: 'auto' }}
                              exit={{ height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="pl-6 space-y-1 mt-1">
                                {item.children.map((child) => (
                                  <Link
                                    key={child.name}
                                    href={child.href}
                                    className={`
                                      flex items-center space-x-3 px-3 py-2 rounded-lg
                                      ${pathname === child.href ? 'bg-bagel-yellow/10 text-bagel-yellow' : 'text-gray-600 hover:bg-gray-100'}
                                    `}
                                  >
                                    {child.icon}
                                    <span className="text-sm">{child.name}</span>
                                    {child.badge && child.badge > 0 && (
                                      <span className="ml-auto px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">
                                        {child.badge}
                                      </span>
                                    )}
                                  </Link>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </>
                    ) : (
                      <Link
                        href={item.href}
                        className={`
                          flex items-center space-x-3 px-3 py-2 rounded-lg
                          ${pathname === item.href ? 'bg-bagel-yellow/10 text-bagel-yellow' : 'text-gray-700 hover:bg-gray-100'}
                        `}
                      >
                        {item.icon}
                        <span className="font-medium">{item.name}</span>
                      </Link>
                    )}
                  </div>
                ))}
              </div>

              {/* Logout Button */}
              <div className="mt-6 pt-6 border-t">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center space-x-3 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <LogOut className="h-5 w-5" />
                  <span className="font-medium">로그아웃</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
          />
        )}
      </AnimatePresence>
    </>
  )
}