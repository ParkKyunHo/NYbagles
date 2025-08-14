'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format, startOfWeek, endOfWeek, addDays, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Calendar, Clock, Users, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface Schedule {
  id: string
  schedule_date: string
  shift_start: string
  shift_end: string
  break_minutes: number
  schedule_type: string
  status: string
  employees: {
    user_id: string
    profiles: {
      full_name: string
      role: string
    }
  }
  stores: {
    name: string
    code: string
  }
}

interface WeekDay {
  date: Date
  dateStr: string
  schedules: Schedule[]
}

export default function SchedulePage() {
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [weekDays, setWeekDays] = useState<WeekDay[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userStore, setUserStore] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkAuth()
    fetchSchedules()
  }, [currentWeek])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/login')
      return
    }

    // 사용자 프로필 정보 가져오기
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile) {
      setUserRole(profile.role)
    }

    // 직원인 경우 소속 매장 정보 가져오기
    if (profile?.role === 'employee' || profile?.role === 'part_time') {
      const { data: employee } = await supabase
        .from('employees')
        .select('store_id')
        .eq('user_id', user.id)
        .single()

      if (employee) {
        setUserStore(employee.store_id)
      }
    }
  }

  const fetchSchedules = async () => {
    setLoading(true)
    
    try {
      const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 })
      const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 })

      let query = supabase
        .from('work_schedules')
        .select(`
          *,
          employees!inner (
            user_id,
            profiles!inner (
              full_name,
              role
            )
          ),
          stores (
            name,
            code
          )
        `)
        .gte('schedule_date', format(weekStart, 'yyyy-MM-dd'))
        .lte('schedule_date', format(weekEnd, 'yyyy-MM-dd'))
        .order('schedule_date', { ascending: true })
        .order('shift_start', { ascending: true })

      // 직원은 자신의 스케줄만 조회
      if (userRole === 'employee' || userRole === 'part_time') {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: employee } = await supabase
            .from('employees')
            .select('id')
            .eq('user_id', user.id)
            .single()

          if (employee) {
            query = query.eq('employee_id', employee.id)
          }
        }
      }
      // 매니저는 자신의 매장 스케줄만 조회
      else if (userRole === 'manager' && userStore) {
        query = query.eq('store_id', userStore)
      }

      const { data: schedules, error } = await query

      if (error) throw error

      // 주간 데이터 구성
      const days: WeekDay[] = []
      for (let i = 0; i < 7; i++) {
        const date = addDays(weekStart, i)
        const dateStr = format(date, 'yyyy-MM-dd')
        days.push({
          date,
          dateStr,
          schedules: schedules?.filter(s => s.schedule_date === dateStr) || []
        })
      }

      setWeekDays(days)
    } catch (error) {
      console.error('Error fetching schedules:', error)
    } finally {
      setLoading(false)
    }
  }

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = new Date(currentWeek)
    newWeek.setDate(currentWeek.getDate() + (direction === 'next' ? 7 : -7))
    setCurrentWeek(newWeek)
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      scheduled: { text: '예정', class: 'bg-gray-100 text-gray-800' },
      confirmed: { text: '확정', class: 'bg-green-100 text-green-800' },
      cancelled: { text: '취소', class: 'bg-red-100 text-red-800' },
      completed: { text: '완료', class: 'bg-blue-100 text-blue-800' },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.scheduled

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.class}`}>
        {config.text}
      </span>
    )
  }

  const formatShiftTime = (start: string, end: string, breakMinutes: number) => {
    const duration = calculateDuration(start, end, breakMinutes)
    return `${start.slice(0, 5)} - ${end.slice(0, 5)} (${duration}시간)`
  }

  const calculateDuration = (start: string, end: string, breakMinutes: number) => {
    const [startHour, startMin] = start.split(':').map(Number)
    const [endHour, endMin] = end.split(':').map(Number)
    
    const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin) - breakMinutes
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    
    return minutes > 0 ? `${hours}.${Math.round(minutes / 60 * 10)}` : `${hours}`
  }

  const canManageSchedules = userRole === 'super_admin' || userRole === 'admin' || userRole === 'manager'

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">근무 스케줄</h1>
          <p className="text-gray-800 mt-2">주간 근무 일정을 확인하고 관리하세요.</p>
        </div>
        {canManageSchedules && (
          <div className="flex gap-2">
            <Link href="/schedule/create">
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                스케줄 등록
              </Button>
            </Link>
            <Link href="/schedule/templates">
              <Button variant="secondary">템플릿 관리</Button>
            </Link>
          </div>
        )}
      </div>

      {/* 주간 네비게이션 */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateWeek('prev')}
            className="flex items-center gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            이전 주
          </Button>
          
          <div className="text-center">
            <h2 className="text-lg font-semibold">
              {format(startOfWeek(currentWeek, { weekStartsOn: 1 }), 'yyyy년 MM월', { locale: ko })}
            </h2>
            <p className="text-sm text-gray-600">
              {format(startOfWeek(currentWeek, { weekStartsOn: 1 }), 'MM/dd', { locale: ko })} - 
              {format(endOfWeek(currentWeek, { weekStartsOn: 1 }), 'MM/dd', { locale: ko })}
            </p>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateWeek('next')}
            className="flex items-center gap-1"
          >
            다음 주
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 주간 스케줄 그리드 */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bagel-yellow mx-auto"></div>
          <p className="mt-4 text-gray-700">로딩 중...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
          {weekDays.map((day) => {
            const isToday = format(day.date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
            const dayOfWeek = format(day.date, 'EEE', { locale: ko })
            
            return (
              <div
                key={day.dateStr}
                className={`bg-white rounded-lg shadow overflow-hidden ${
                  isToday ? 'ring-2 ring-bagel-yellow' : ''
                }`}
              >
                <div className={`p-3 text-center ${
                  isToday ? 'bg-bagel-yellow text-bagel-black font-semibold' : 'bg-gray-50 text-gray-900'
                }`}>
                  <p className="text-sm font-medium">{dayOfWeek}</p>
                  <p className="text-lg font-semibold">
                    {format(day.date, 'MM/dd')}
                  </p>
                </div>
                
                <div className="p-3 space-y-2">
                  {day.schedules.length === 0 ? (
                    <p className="text-sm text-gray-600 text-center py-4">
                      스케줄 없음
                    </p>
                  ) : (
                    day.schedules.map((schedule) => (
                      <div
                        key={schedule.id}
                        className="border rounded p-2 hover:bg-gray-50 cursor-pointer"
                        onClick={() => router.push(`/schedule/${schedule.id}`)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium">
                            {schedule.employees.profiles.full_name}
                          </p>
                          {getStatusBadge(schedule.status)}
                        </div>
                        <p className="text-xs text-gray-600">
                          {formatShiftTime(
                            schedule.shift_start,
                            schedule.shift_end,
                            schedule.break_minutes
                          )}
                        </p>
                        {schedule.stores && (
                          <p className="text-xs text-gray-700 mt-1">
                            {schedule.stores.name}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 스케줄 요약 */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">이번 주 총 근무 시간</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">
                {weekDays.reduce((total, day) => {
                  return total + day.schedules.reduce((dayTotal, schedule) => {
                    return dayTotal + parseFloat(
                      calculateDuration(schedule.shift_start, schedule.shift_end, schedule.break_minutes)
                    )
                  }, 0)
                }, 0).toFixed(1)}시간
              </p>
            </div>
            <Clock className="h-8 w-8 text-gray-800" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">이번 주 근무일</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">
                {weekDays.filter(day => day.schedules.length > 0).length}일
              </p>
            </div>
            <Calendar className="h-8 w-8 text-gray-800" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">총 스케줄 수</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">
                {weekDays.reduce((total, day) => total + day.schedules.length, 0)}개
              </p>
            </div>
            <Users className="h-8 w-8 text-gray-800" />
          </div>
        </div>
      </div>
    </div>
  )
}