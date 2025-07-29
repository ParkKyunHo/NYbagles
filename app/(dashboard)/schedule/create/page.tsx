'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format, addDays } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Calendar, Clock, Users, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Employee {
  id: string
  user_id: string
  profiles: {
    full_name: string
    role: string
  }
}

interface Store {
  id: string
  name: string
  code: string
}

interface ScheduleEntry {
  date: string
  employeeId: string
  startTime: string
  endTime: string
  breakMinutes: number
}

export default function CreateSchedulePage() {
  const [stores, setStores] = useState<Store[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedStore, setSelectedStore] = useState('')
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(addDays(new Date(), 6), 'yyyy-MM-dd'))
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkAuth()
    fetchStores()
  }, [])

  useEffect(() => {
    if (selectedStore) {
      fetchEmployees()
    }
  }, [selectedStore])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/login')
      return
    }

    // 권한 확인
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['super_admin', 'admin', 'manager'].includes(profile.role)) {
      router.push('/schedule')
    }
  }

  const fetchStores = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    let query = supabase
      .from('stores')
      .select('*')
      .eq('is_active', true)
      .order('name')

    // 매니저는 자신의 매장만
    if (profile?.role === 'manager') {
      const { data: employee } = await supabase
        .from('employees')
        .select('store_id')
        .eq('user_id', user.id)
        .single()

      if (employee?.store_id) {
        query = query.eq('id', employee.store_id)
      }
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching stores:', error)
    } else {
      setStores(data || [])
      if (data && data.length === 1) {
        setSelectedStore(data[0].id)
      }
    }
  }

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from('employees')
      .select(`
        *,
        profiles!inner (
          full_name,
          role
        )
      `)
      .eq('store_id', selectedStore)
      .eq('is_active', true)
      .order('profiles(full_name)')

    if (error) {
      console.error('Error fetching employees:', error)
    } else {
      setEmployees(data || [])
    }
  }

  const addScheduleEntry = () => {
    setScheduleEntries([
      ...scheduleEntries,
      {
        date: startDate,
        employeeId: '',
        startTime: '09:00',
        endTime: '18:00',
        breakMinutes: 60
      }
    ])
  }

  const updateScheduleEntry = (index: number, field: keyof ScheduleEntry, value: any) => {
    const updated = [...scheduleEntries]
    updated[index] = { ...updated[index], [field]: value }
    setScheduleEntries(updated)
  }

  const removeScheduleEntry = (index: number) => {
    setScheduleEntries(scheduleEntries.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!selectedStore) {
      setError('매장을 선택해주세요.')
      return
    }

    if (scheduleEntries.length === 0) {
      setError('최소 하나 이상의 스케줄을 추가해주세요.')
      return
    }

    // 유효성 검사
    for (const entry of scheduleEntries) {
      if (!entry.employeeId || !entry.date || !entry.startTime || !entry.endTime) {
        setError('모든 필드를 입력해주세요.')
        return
      }

      if (entry.startTime >= entry.endTime) {
        setError('종료 시간은 시작 시간보다 늦어야 합니다.')
        return
      }
    }

    setLoading(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('인증 오류')

      // 스케줄 생성
      const schedules = scheduleEntries.map(entry => ({
        employee_id: entry.employeeId,
        store_id: selectedStore,
        schedule_date: entry.date,
        shift_start: entry.startTime,
        shift_end: entry.endTime,
        break_minutes: entry.breakMinutes,
        schedule_type: 'regular',
        status: 'scheduled',
        created_by: user.id
      }))

      const { error: insertError } = await supabase
        .from('work_schedules')
        .insert(schedules)

      if (insertError) throw insertError

      router.push('/schedule')
    } catch (error) {
      console.error('Error creating schedules:', error)
      setError('스케줄 생성 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const generateWeeklySchedule = () => {
    const entries: ScheduleEntry[] = []
    const start = new Date(startDate)
    const end = new Date(endDate)

    while (start <= end) {
      // 주말 제외
      if (start.getDay() !== 0 && start.getDay() !== 6) {
        entries.push({
          date: format(start, 'yyyy-MM-dd'),
          employeeId: '',
          startTime: '09:00',
          endTime: '18:00',
          breakMinutes: 60
        })
      }
      start.setDate(start.getDate() + 1)
    }

    setScheduleEntries(entries)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">스케줄 등록</h1>
        <p className="text-gray-600 mt-2">직원들의 근무 스케줄을 등록하세요.</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* 매장 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            매장 선택
          </label>
          <select
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow"
          >
            <option value="">매장을 선택하세요</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name} ({store.code})
              </option>
            ))}
          </select>
        </div>

        {/* 기간 설정 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              시작 날짜
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              종료 날짜
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow"
            />
          </div>
        </div>

        {/* 빠른 생성 버튼 */}
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={generateWeeklySchedule}
            disabled={!selectedStore}
          >
            주간 스케줄 생성 (평일)
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={addScheduleEntry}
            disabled={!selectedStore}
          >
            개별 스케줄 추가
          </Button>
        </div>

        {/* 스케줄 목록 */}
        {scheduleEntries.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-medium text-gray-900">스케줄 목록</h3>
            {scheduleEntries.map((entry, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      날짜
                    </label>
                    <input
                      type="date"
                      value={entry.date}
                      onChange={(e) => updateScheduleEntry(index, 'date', e.target.value)}
                      min={startDate}
                      max={endDate}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      직원
                    </label>
                    <select
                      value={entry.employeeId}
                      onChange={(e) => updateScheduleEntry(index, 'employeeId', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                      <option value="">선택하세요</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.profiles.full_name} ({emp.profiles.role})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      시작 시간
                    </label>
                    <input
                      type="time"
                      value={entry.startTime}
                      onChange={(e) => updateScheduleEntry(index, 'startTime', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      종료 시간
                    </label>
                    <input
                      type="time"
                      value={entry.endTime}
                      onChange={(e) => updateScheduleEntry(index, 'endTime', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center text-sm">
                      휴게시간:
                      <input
                        type="number"
                        value={entry.breakMinutes}
                        onChange={(e) => updateScheduleEntry(index, 'breakMinutes', parseInt(e.target.value) || 0)}
                        className="ml-2 w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                        min="0"
                        step="30"
                      />
                      <span className="ml-1">분</span>
                    </label>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeScheduleEntry(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    삭제
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 버튼 */}
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => router.push('/schedule')}
          >
            취소
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || scheduleEntries.length === 0}
          >
            {loading ? '등록 중...' : '스케줄 등록'}
          </Button>
        </div>
      </div>
    </div>
  )
}