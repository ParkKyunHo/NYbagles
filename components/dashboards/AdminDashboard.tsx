'use client'

import { Card } from '@/components/ui/card'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function AdminDashboard() {
  const [stats, setStats] = useState({
    totalStores: 0,
    totalEmployees: 0,
    todaySales: 0,
    pendingRequests: 0
  })
  
  const supabase = createClient()

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    const [stores, employees, sales, requests] = await Promise.all([
      supabase.from('stores').select('id', { count: 'exact' }),
      supabase.from('employees').select('id', { count: 'exact' }),
      supabase.from('sales_records')
        .select('total_amount')
        .gte('sale_date', new Date().toISOString().split('T')[0]),
      supabase.from('employee_signup_requests')
        .select('id', { count: 'exact' })
        .eq('status', 'pending')
    ])

    setStats({
      totalStores: stores.count || 0,
      totalEmployees: employees.count || 0,
      todaySales: sales.data?.reduce((sum, s) => sum + s.total_amount, 0) || 0,
      pendingRequests: requests.count || 0
    })
  }

  const adminFeatures = [
    { title: '매장 관리', href: '/admin/stores', icon: '🏪', desc: '매장 정보 관리' },
    { title: '직원 관리', href: '/dashboard/employees', icon: '👥', desc: '직원 정보 및 권한' },
    { title: '상품 승인', href: '/products/approvals', icon: '✅', desc: '상품 변경 승인' },
    { title: '매출 분석', href: '/dashboard/analytics', icon: '📊', desc: '매출 통계 및 분석' },
    { title: '가입 승인', href: '/admin/signup-requests', icon: '📝', desc: '직원 가입 요청' },
    { title: '급여 관리', href: '/dashboard/salary', icon: '💰', desc: '급여 계산 및 관리' }
  ]

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">관리자 대시보드</h1>
        <p className="text-gray-800 mt-2">전체 매장 관리 및 운영</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-gray-800">관리 매장</div>
          <div className="text-2xl font-bold">{stats.totalStores}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-800">전체 직원</div>
          <div className="text-2xl font-bold">{stats.totalEmployees}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-800">오늘 매출</div>
          <div className="text-2xl font-bold">₩{stats.todaySales.toLocaleString()}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-800">대기 요청</div>
          <div className="text-2xl font-bold text-orange-600">{stats.pendingRequests}</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {adminFeatures.map((feature) => (
          <Link key={feature.href} href={feature.href}>
            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="flex items-start gap-4">
                <div className="text-4xl">{feature.icon}</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">{feature.title}</h3>
                  <p className="text-sm text-gray-700">{feature.desc}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">빠른 작업</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/employees" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            직원 추가
          </Link>
          <Link href="/products/v2" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
            상품 관리
          </Link>
          <Link href="/sales/summary" className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
            매출 보고서
          </Link>
          <Link href="/schedule" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
            근무 일정
          </Link>
        </div>
      </Card>
    </div>
  )
}