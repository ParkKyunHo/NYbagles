import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }
  
  // 사용자 프로필 정보 가져오기
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id)
    .single()
    
  // 직원 정보 가져오기 (직원인 경우)
  const { data: employee } = await supabase
    .from('employees')
    .select(`
      *,
      stores (
        id,
        name,
        store_code
      )
    `)
    .eq('user_id', user?.id)
    .single()
    
  // 오늘의 출퇴근 기록
  const today = new Date().toISOString().split('T')[0]
  const { data: todayAttendance } = employee ? await supabase
    .from('attendance_records')
    .select('*')
    .eq('employee_id', employee.id)
    .eq('work_date', today)
    .single() : { data: null }
    
  // 이번 주 근무 시간 계산
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  weekStart.setHours(0, 0, 0, 0)
  
  const { data: weekRecords } = employee ? await supabase
    .from('attendance_records')
    .select('*')
    .eq('employee_id', employee.id)
    .gte('work_date', weekStart.toISOString().split('T')[0]) : { data: null }
    
  // 이번 달 근무 시간 계산
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  
  const { data: monthRecords } = employee ? await supabase
    .from('attendance_records')
    .select('*')
    .eq('employee_id', employee.id)
    .gte('work_date', monthStart.toISOString().split('T')[0]) : { data: null }
  
  // 총 근무 시간 계산
  let totalWeekHours = 0
  let totalMonthHours = 0
  
  if (weekRecords) {
    weekRecords.forEach(record => {
      if (record.total_hours) {
        totalWeekHours += Number(record.total_hours)
      } else if (record.check_in_time && record.check_out_time) {
        const checkIn = new Date(record.check_in_time)
        const checkOut = new Date(record.check_out_time)
        const hours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)
        totalWeekHours += hours
      }
    })
  }
  
  if (monthRecords) {
    monthRecords.forEach(record => {
      if (record.total_hours) {
        totalMonthHours += Number(record.total_hours)
      } else if (record.check_in_time && record.check_out_time) {
        const checkIn = new Date(record.check_in_time)
        const checkOut = new Date(record.check_out_time)
        const hours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)
        totalMonthHours += hours
      }
    })
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="mt-1 text-sm text-gray-700">
          환영합니다, {profile?.full_name || user?.email}님
        </p>
        {employee?.stores && (
          <p className="mt-1 text-sm text-gray-700">
            소속: {employee.stores.name} ({employee.stores.store_code})
          </p>
        )}
      </div>

      {/* 대시보드 통계 카드 */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-3 sm:p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="rounded-md bg-blue-500 p-3">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-3 sm:ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-xs sm:text-sm font-medium text-gray-700 truncate">
                    오늘 출근 상태
                  </dt>
                  <dd className="text-sm sm:text-lg font-semibold text-gray-900">
                    {todayAttendance ? (
                      todayAttendance.check_out_time ? '퇴근 완료' : '근무 중'
                    ) : '미출근'}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-3 sm:p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="rounded-md bg-green-500 p-2 sm:p-3">
                  <svg className="h-4 w-4 sm:h-6 sm:w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-3 sm:ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-xs sm:text-sm font-medium text-gray-700 truncate">
                    이번 주 근무시간
                  </dt>
                  <dd className="text-sm sm:text-lg font-semibold text-gray-900">
                    {totalWeekHours.toFixed(1)}시간
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-3 sm:p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="rounded-md bg-yellow-500 p-2 sm:p-3">
                  <svg className="h-4 w-4 sm:h-6 sm:w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
              </div>
              <div className="ml-3 sm:ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-xs sm:text-sm font-medium text-gray-700 truncate">
                    이번 주 근무일
                  </dt>
                  <dd className="text-sm sm:text-lg font-semibold text-gray-900">
                    {weekRecords?.length || 0}일
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-3 sm:p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="rounded-md bg-red-500 p-2 sm:p-3">
                  <svg className="h-4 w-4 sm:h-6 sm:w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-3 sm:ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-xs sm:text-sm font-medium text-gray-700 truncate">
                    이번 달 근무시간
                  </dt>
                  <dd className="text-sm sm:text-lg font-semibold text-gray-900">
                    {totalMonthHours.toFixed(1)}시간
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 빠른 액션 버튼 */}
      <div className="mt-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">빠른 실행</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Link href="/dashboard/attendance/scan" className="relative rounded-lg p-6 bg-white shadow hover:shadow-md transition-shadow block">
            <div className="text-center">
              <div className="rounded-md bg-primary-100 p-3 inline-block mb-3">
                <QrCode className="h-8 w-8 text-primary-600" />
              </div>
              <h3 className="text-sm font-medium text-gray-900">QR 스캔</h3>
            </div>
          </Link>
          
          <Link href="/dashboard/attendance" className="relative rounded-lg p-6 bg-white shadow hover:shadow-md transition-shadow block">
            <div className="text-center">
              <div className="rounded-md bg-green-100 p-3 inline-block mb-3">
                <Clock className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-sm font-medium text-gray-900">출퇴근 기록</h3>
            </div>
          </Link>
          
          <Link href="/dashboard/work-hours" className="relative rounded-lg p-6 bg-white shadow hover:shadow-md transition-shadow block">
            <div className="text-center">
              <div className="rounded-md bg-yellow-100 p-3 inline-block mb-3">
                <Calendar className="h-8 w-8 text-yellow-600" />
              </div>
              <h3 className="text-sm font-medium text-gray-900">근무 시간</h3>
            </div>
          </Link>
          
          <Link href="/dashboard/settings" className="relative rounded-lg p-6 bg-white shadow hover:shadow-md transition-shadow block">
            <div className="text-center">
              <div className="rounded-md bg-purple-100 p-3 inline-block mb-3">
                <Settings className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-sm font-medium text-gray-900">설정</h3>
            </div>
          </Link>
        </div>
      </div>
      
      {/* 최근 출퇴근 기록 */}
      <div className="mt-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">오늘의 근무 상태</h2>
        <div className="bg-white shadow rounded-lg p-6">
          {todayAttendance ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700">출근 시간</p>
                  <p className="text-lg font-medium">
                    {new Date(todayAttendance.check_in_time).toLocaleTimeString('ko-KR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                {todayAttendance.check_out_time ? (
                  <div>
                    <p className="text-sm text-gray-700">퇴근 시간</p>
                    <p className="text-lg font-medium">
                      {new Date(todayAttendance.check_out_time).toLocaleTimeString('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                      근무 중
                    </div>
                  </div>
                )}
              </div>
              
              {!todayAttendance.check_out_time && (
                <div className="pt-4 border-t">
                  <Link href="/dashboard/attendance/scan">
                    <button className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-bagel-black bg-bagel-yellow hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-bagel-yellow">
                      퇴근하기
                    </button>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-700 mb-4">아직 출근하지 않았습니다</p>
              <Link href="/dashboard/attendance/scan">
                <button className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-bagel-black bg-bagel-yellow hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-bagel-yellow">
                  출근하기
                </button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// 필요한 아이콘 import
import { QrCode, Clock, Calendar, Settings } from 'lucide-react'