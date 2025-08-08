'use client'

import { Card } from '@/components/ui/card'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthCheck } from '@/hooks/useAuthCheck'

export function ManagerDashboard() {
  const { storeId, storeName } = useAuthCheck()
  const [stats, setStats] = useState({
    todaySales: 0,
    todayEmployees: 0,
    pendingTasks: 0,
    lowStock: 0
  })
  
  const supabase = createClient()

  useEffect(() => {
    if (storeId) {
      fetchStats()
    }
  }, [storeId])

  const fetchStats = async () => {
    const today = new Date().toISOString().split('T')[0]
    
    const [sales, attendance, products] = await Promise.all([
      supabase.from('sales_records')
        .select('total_amount')
        .gte('sale_date', today),
      supabase.from('attendance_records')
        .select('id', { count: 'exact' })
        .eq('store_id', storeId)
        .eq('work_date', today),
      supabase.from('products')
        .select('id', { count: 'exact' })
        .eq('is_active', true)
    ])

    setStats({
      todaySales: sales.data?.reduce((sum, s) => sum + s.total_amount, 0) || 0,
      todayEmployees: attendance.count || 0,
      pendingTasks: 0,
      lowStock: 0
    })
  }

  const managerFeatures = [
    { title: '판매 관리', href: '/sales/simple', icon: '💳', desc: '간편 판매 및 정산' },
    { title: '재고 관리', href: '/products/store', icon: '📦', desc: '매장 재고 확인' },
    { title: '근태 관리', href: '/attendance', icon: '⏰', desc: '직원 출퇴근 관리' },
    { title: '근무 일정', href: '/schedule', icon: '📅', desc: '일정 확인 및 관리' },
    { title: '매출 현황', href: '/sales/summary', icon: '📊', desc: '매출 통계 확인' },
    { title: '직원 정보', href: '/dashboard/employees', icon: '👥', desc: '직원 목록 확인' }
  ]

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">매니저 대시보드</h1>
        <p className="text-gray-600 mt-2">{storeName} 매장 운영 관리</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-gray-600">오늘 매출</div>
          <div className="text-2xl font-bold">₩{stats.todaySales.toLocaleString()}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">출근 직원</div>
          <div className="text-2xl font-bold">{stats.todayEmployees}명</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">대기 업무</div>
          <div className="text-2xl font-bold text-orange-600">{stats.pendingTasks}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">재고 부족</div>
          <div className="text-2xl font-bold text-red-600">{stats.lowStock}</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {managerFeatures.map((feature) => (
          <Link key={feature.href} href={feature.href}>
            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="flex items-start gap-4">
                <div className="text-4xl">{feature.icon}</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">{feature.title}</h3>
                  <p className="text-sm text-gray-600">{feature.desc}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">오늘의 업무</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-yellow-50 rounded">
            <span>오전 재고 확인</span>
            <span className="text-sm text-gray-600">09:00</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-green-50 rounded">
            <span>중간 정산</span>
            <span className="text-sm text-gray-600">15:00</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded">
            <span>마감 정산</span>
            <span className="text-sm text-gray-600">22:00</span>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">빠른 작업</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/sales/simple" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            판매 시작
          </Link>
          <Link href="/attendance/scan" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
            QR 체크인
          </Link>
          <Link href="/sales/closing" className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
            마감 정산
          </Link>
          <Link href="/products/store" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
            재고 확인
          </Link>
        </div>
      </Card>
    </div>
  )
}