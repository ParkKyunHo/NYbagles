'use client'

import { Card } from '@/components/ui/card'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthCheck } from '@/hooks/useAuthCheck'

export function EmployeeDashboard() {
  const { userId, storeId, storeName, userRole } = useAuthCheck()
  const [stats, setStats] = useState({
    todayHours: 0,
    monthlyHours: 0,
    todayStatus: '',
    nextSchedule: ''
  })
  
  const supabase = createClient()

  useEffect(() => {
    if (userId && storeId) {
      fetchStats()
    }
  }, [userId, storeId])

  const fetchStats = async () => {
    const today = new Date().toISOString().split('T')[0]
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
    
    const [todayAttendance, monthAttendance] = await Promise.all([
      supabase.from('attendance_records')
        .select('*')
        .eq('employee_id', userId)
        .eq('work_date', today)
        .single(),
      supabase.from('attendance_records')
        .select('total_hours')
        .eq('employee_id', userId)
        .gte('work_date', monthStart)
    ])

    const totalMonthlyHours = monthAttendance.data?.reduce((sum, record) => sum + (record.total_hours || 0), 0) || 0

    setStats({
      todayHours: todayAttendance.data?.total_hours || 0,
      monthlyHours: totalMonthlyHours,
      todayStatus: todayAttendance.data?.check_in_time ? '근무중' : '미출근',
      nextSchedule: '내일 09:00'
    })
  }

  const employeeFeatures = [
    { title: '출퇴근', href: '/attendance/scan', icon: '⏰', desc: 'QR 체크인/체크아웃' },
    { title: '근무 시간', href: '/dashboard/work-hours', icon: '📊', desc: '근무 시간 확인' },
    { title: '일정 확인', href: '/schedule', icon: '📅', desc: '근무 일정 확인' },
    { title: '서류 관리', href: '/dashboard/documents', icon: '📄', desc: '필수 서류 업로드' },
    { title: '급여 조회', href: '/dashboard/salary', icon: '💰', desc: '급여 내역 확인' },
    { title: '설정', href: '/dashboard/settings', icon: '⚙️', desc: '개인 정보 수정' }
  ]

  const partTimeFeatures = employeeFeatures.filter(f => 
    !['/dashboard/salary'].includes(f.href)
  )

  const features = userRole === 'part_time' ? partTimeFeatures : employeeFeatures

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          {userRole === 'part_time' ? '파트타임' : '직원'} 대시보드
        </h1>
        <p className="text-gray-800 mt-2">{storeName} - 근무 관리</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-gray-800">오늘 근무</div>
          <div className="text-2xl font-bold">{stats.todayHours}시간</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-800">이번달 근무</div>
          <div className="text-2xl font-bold">{stats.monthlyHours}시간</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-800">출근 상태</div>
          <div className="text-2xl font-bold text-green-600">{stats.todayStatus}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-800">다음 근무</div>
          <div className="text-2xl font-bold">{stats.nextSchedule}</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature) => (
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
        <h2 className="text-xl font-semibold mb-4">오늘의 공지</h2>
        <div className="space-y-3">
          <div className="p-3 bg-blue-50 rounded">
            <div className="font-medium">월말 정산 안내</div>
            <div className="text-sm text-gray-700 mt-1">
              이번 달 급여는 다음 주 월요일에 지급됩니다.
            </div>
          </div>
          <div className="p-3 bg-yellow-50 rounded">
            <div className="font-medium">건강검진 안내</div>
            <div className="text-sm text-gray-700 mt-1">
              연례 건강검진이 다음 달에 예정되어 있습니다.
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">빠른 작업</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/attendance/scan" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            출근하기
          </Link>
          <Link href="/schedule" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
            일정 확인
          </Link>
          <Link href="/dashboard/documents" className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
            서류 업로드
          </Link>
          <Link href="/dashboard/settings" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
            정보 수정
          </Link>
        </div>
      </Card>
    </div>
  )
}