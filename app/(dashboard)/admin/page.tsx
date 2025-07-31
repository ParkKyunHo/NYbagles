'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface DashboardStats {
  totalStores: number
  totalEmployees: number
  pendingRequests: number
  todayAttendance: number
}

export default function AdminPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalStores: 0,
    totalEmployees: 0,
    pendingRequests: 0,
    todayAttendance: 0,
  })
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  const checkAuth = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/login')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['super_admin', 'admin', 'manager'].includes(profile.role)) {
      router.push('/dashboard')
    }
  }, [router, supabase])

  const fetchDashboardStats = useCallback(async () => {
    setLoading(true)
    try {
      // 매장 수
      const { count: storeCount } = await supabase
        .from('stores')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)

      // 직원 수
      const { count: employeeCount } = await supabase
        .from('employees')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)

      // 대기 중인 가입 요청
      const response = await fetch('/api/admin/signup-requests?status=verified')
      const requestData = await response.json()
      const pendingCount = requestData.requests?.length || 0

      // 오늘 출근한 직원 수
      const today = new Date().toISOString().split('T')[0]
      const { count: attendanceCount } = await supabase
        .from('attendance_records')
        .select('*', { count: 'exact', head: true })
        .gte('check_in_time', `${today}T00:00:00`)
        .lte('check_in_time', `${today}T23:59:59`)

      setStats({
        totalStores: storeCount || 0,
        totalEmployees: employeeCount || 0,
        pendingRequests: pendingCount,
        todayAttendance: attendanceCount || 0,
      })
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    const init = async () => {
      await checkAuth()
      await fetchDashboardStats()
    }
    init()
  }, [checkAuth, fetchDashboardStats])

  const adminMenuItems = [
    {
      title: '직원 가입 요청',
      description: '직원 가입 요청을 검토하고 승인합니다',
      href: '/admin/signup-requests',
      icon: '👥',
      badge: stats.pendingRequests > 0 ? stats.pendingRequests : null,
    },
    {
      title: '매장 관리',
      description: '매장 정보와 QR 코드를 관리합니다',
      href: '/admin/stores',
      icon: '🏪',
    },
    {
      title: '직원 관리',
      description: '전체 직원 목록과 권한을 관리합니다',
      href: '/admin/employees',
      icon: '👤',
    },
    {
      title: '지역 관리',
      description: '지역과 매장 카테고리를 관리합니다',
      href: '/admin/regions',
      icon: '📍',
    },
    {
      title: '시스템 설정',
      description: '시스템 전반의 설정을 관리합니다',
      href: '/admin/system-settings',
      icon: '⚙️',
    },
    {
      title: '보고서',
      description: '매출 및 근무 현황 보고서를 확인합니다',
      href: '/admin/reports',
      icon: '📊',
    },
  ]

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">관리자 대시보드</h1>
        <p className="text-gray-600 mt-2">뉴욕러브베이글 통합 관리 시스템</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">전체 매장</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">
                {loading ? '...' : stats.totalStores}
              </p>
            </div>
            <div className="text-3xl">🏪</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">전체 직원</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">
                {loading ? '...' : stats.totalEmployees}
              </p>
            </div>
            <div className="text-3xl">👥</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">대기 중인 요청</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">
                {loading ? '...' : stats.pendingRequests}
              </p>
            </div>
            <div className="text-3xl">⏳</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">오늘 출근</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">
                {loading ? '...' : stats.todayAttendance}
              </p>
            </div>
            <div className="text-3xl">✅</div>
          </div>
        </div>
      </div>

      {/* 관리 메뉴 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {adminMenuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow duration-200"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="text-4xl">{item.icon}</div>
              {item.badge && (
                <span className="bg-bagel-yellow text-bagel-black text-xs font-bold rounded-full px-2 py-1">
                  {item.badge}
                </span>
              )}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {item.title}
            </h3>
            <p className="text-sm text-gray-600">{item.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}