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

  // 역할 기반 퀵 링크
  const getQuickLinks = (role: string) => {
    const commonLinks = [
      { href: '/attendance/scan', label: '출퇴근 체크', icon: '⏰' },
      { href: '/schedule', label: '근무 일정', icon: '📅' },
    ]
    
    switch(role) {
      case 'super_admin':
        return [
          { href: '/admin/stores', label: '매장 관리', icon: '🏪' },
          { href: '/admin/signup-requests', label: '가입 승인', icon: '👥' },
          { href: '/products/approvals', label: '상품 승인', icon: '✅' },
          { href: '/dashboard/analytics', label: '데이터 분석', icon: '📊' },
          { href: '/admin/permissions', label: '권한 관리', icon: '🔐' },
          { href: '/admin/backup', label: '백업/복구', icon: '💾' }
        ]
      case 'admin':
        return [
          { href: '/dashboard/employees', label: '직원 관리', icon: '👥' },
          { href: '/products/approvals', label: '상품 승인', icon: '✅' },
          { href: '/sales/summary', label: '매출 분석', icon: '📊' },
          { href: '/admin/signup-requests', label: '가입 승인', icon: '📝' },
          { href: '/dashboard/salary', label: '급여 관리', icon: '💰' },
          ...commonLinks
        ]
      case 'manager':
        return [
          { href: '/sales/simple', label: '판매 관리', icon: '💳' },
          { href: '/products/store', label: '재고 관리', icon: '📦' },
          { href: '/attendance', label: '근태 관리', icon: '⏰' },
          { href: '/sales/summary', label: '매출 현황', icon: '📊' },
          { href: '/dashboard/employees', label: '직원 정보', icon: '👥' },
          ...commonLinks
        ]
      case 'employee':
        return [
          ...commonLinks,
          { href: '/dashboard/work-hours', label: '근무 시간', icon: '📊' },
          { href: '/dashboard/documents', label: '서류 관리', icon: '📄' },
          { href: '/dashboard/salary', label: '급여 조회', icon: '💰' },
          { href: '/dashboard/settings', label: '설정', icon: '⚙️' }
        ]
      case 'part_time':
        return [
          ...commonLinks,
          { href: '/dashboard/work-hours', label: '근무 시간', icon: '📊' },
          { href: '/dashboard/documents', label: '서류 관리', icon: '📄' },
          { href: '/dashboard/settings', label: '설정', icon: '⚙️' }
        ]
      default:
        return commonLinks
    }
  }

  const quickLinks = getQuickLinks(profile?.role || 'employee')

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
        {profile?.role && (
          <p className="mt-1 text-sm text-gray-700">
            권한: {
              profile.role === 'super_admin' ? '시스템 관리자' :
              profile.role === 'admin' ? '관리자' :
              profile.role === 'manager' ? '매니저' :
              profile.role === 'employee' ? '직원' :
              profile.role === 'part_time' ? '파트타임' : profile.role
            }
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

      {/* 퀵 링크 */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">빠른 메뉴</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="bg-white p-4 rounded-lg shadow hover:shadow-lg transition-shadow duration-200 flex flex-col items-center text-center"
            >
              <span className="text-3xl mb-2">{link.icon}</span>
              <span className="text-sm font-medium text-gray-900">{link.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* 공지사항 및 알림 */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">공지사항</h2>
          <div className="space-y-3">
            <div className="border-l-4 border-blue-500 pl-4">
              <p className="text-sm font-medium text-gray-900">월말 정산 안내</p>
              <p className="text-sm text-gray-600 mt-1">이번 달 급여는 다음 주 월요일에 지급됩니다.</p>
            </div>
            <div className="border-l-4 border-yellow-500 pl-4">
              <p className="text-sm font-medium text-gray-900">건강검진 안내</p>
              <p className="text-sm text-gray-600 mt-1">연례 건강검진이 다음 달에 예정되어 있습니다.</p>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">오늘의 할 일</h2>
          <div className="space-y-3">
            {profile?.role === 'manager' && (
              <>
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded">
                  <span className="text-sm font-medium">오전 재고 확인</span>
                  <span className="text-xs text-gray-600">09:00</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded">
                  <span className="text-sm font-medium">중간 정산</span>
                  <span className="text-xs text-gray-600">15:00</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded">
                  <span className="text-sm font-medium">마감 정산</span>
                  <span className="text-xs text-gray-600">22:00</span>
                </div>
              </>
            )}
            {(profile?.role === 'employee' || profile?.role === 'part_time') && (
              <>
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded">
                  <span className="text-sm font-medium">출근 체크</span>
                  <span className="text-xs text-gray-600">근무 시작 시</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded">
                  <span className="text-sm font-medium">판매 업무</span>
                  <span className="text-xs text-gray-600">근무 중</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded">
                  <span className="text-sm font-medium">퇴근 체크</span>
                  <span className="text-xs text-gray-600">근무 종료 시</span>
                </div>
              </>
            )}
            {(profile?.role === 'admin' || profile?.role === 'super_admin') && (
              <>
                <div className="flex items-center justify-between p-3 bg-red-50 rounded">
                  <span className="text-sm font-medium">가입 승인 확인</span>
                  <span className="text-xs text-gray-600">매일</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-purple-50 rounded">
                  <span className="text-sm font-medium">매출 리포트 확인</span>
                  <span className="text-xs text-gray-600">매일</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-indigo-50 rounded">
                  <span className="text-sm font-medium">시스템 점검</span>
                  <span className="text-xs text-gray-600">주 1회</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}