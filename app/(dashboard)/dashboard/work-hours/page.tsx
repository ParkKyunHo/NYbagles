'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Calendar, Clock, Download, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AttendanceRecord {
  id: string
  work_date: string
  check_in_time: string | null
  check_out_time: string | null
  total_hours: number | null
  status: string
  stores: {
    name: string
    code: string
  }
}

interface MonthSummary {
  totalDays: number
  totalHours: number
  averageHours: number
  lateDays: number
  absentDays: number
}

export default function WorkHoursPage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')
  const [monthSummary, setMonthSummary] = useState<MonthSummary>({
    totalDays: 0,
    totalHours: 0,
    averageHours: 0,
    lateDays: 0,
    absentDays: 0,
  })
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkAuth()
    fetchAttendanceRecords()
  }, [selectedMonth, viewMode])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/login')
    }
  }

  const fetchAttendanceRecords = async () => {
    setLoading(true)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 직원 정보 가져오기
      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!employee) return

      // 날짜 범위 설정
      let startDate, endDate
      if (viewMode === 'month') {
        startDate = startOfMonth(selectedMonth)
        endDate = endOfMonth(selectedMonth)
      } else {
        startDate = startOfWeek(selectedMonth, { weekStartsOn: 1 })
        endDate = endOfWeek(selectedMonth, { weekStartsOn: 1 })
      }

      // 출퇴근 기록 가져오기
      const { data: records, error } = await supabase
        .from('attendance_records')
        .select(`
          *,
          stores (
            name,
            code
          )
        `)
        .eq('employee_id', employee.id)
        .gte('work_date', format(startDate, 'yyyy-MM-dd'))
        .lte('work_date', format(endDate, 'yyyy-MM-dd'))
        .order('work_date', { ascending: false })

      if (error) throw error

      setRecords(records || [])
      calculateSummary(records || [])
    } catch (error) {
      console.error('Error fetching attendance records:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateSummary = (records: AttendanceRecord[]) => {
    const summary = records.reduce((acc, record) => {
      if (record.status === 'present') {
        acc.totalDays++
        if (record.total_hours) {
          acc.totalHours += Number(record.total_hours)
        }
      } else if (record.status === 'late') {
        acc.lateDays++
        if (record.total_hours) {
          acc.totalHours += Number(record.total_hours)
        }
      } else if (record.status === 'absent') {
        acc.absentDays++
      }
      return acc
    }, {
      totalDays: 0,
      totalHours: 0,
      lateDays: 0,
      absentDays: 0,
      averageHours: 0,
    })

    const workingDays = summary.totalDays + summary.lateDays
    summary.averageHours = workingDays > 0 ? summary.totalHours / workingDays : 0

    setMonthSummary(summary)
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      present: { text: '정상', class: 'bg-green-100 text-green-800' },
      late: { text: '지각', class: 'bg-yellow-100 text-yellow-800' },
      absent: { text: '결근', class: 'bg-red-100 text-red-800' },
      holiday: { text: '휴일', class: 'bg-gray-100 text-gray-800' },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.present

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.class}`}>
        {config.text}
      </span>
    )
  }

  const formatDuration = (hours: number) => {
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    return `${h}시간 ${m}분`
  }

  const handleExport = async () => {
    // CSV 내보내기 기능 (추후 구현)
    alert('CSV 내보내기 기능은 준비 중입니다.')
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">근무 시간 조회</h1>
        <p className="text-gray-600 mt-2">출퇴근 기록과 근무 시간을 확인하세요.</p>
      </div>

      {/* 필터 컨트롤 */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as 'month' | 'week')}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow text-gray-900 bg-white"
            >
              <option value="month">월별 보기</option>
              <option value="week">주별 보기</option>
            </select>

            <input
              type="month"
              value={format(selectedMonth, 'yyyy-MM')}
              onChange={(e) => setSelectedMonth(parseISO(e.target.value + '-01'))}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow text-gray-900 bg-white"
            />
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleExport}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            내보내기
          </Button>
        </div>
      </div>

      {/* 월간 요약 */}
      {viewMode === 'month' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">총 근무일</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">
                  {monthSummary.totalDays}일
                </p>
              </div>
              <Calendar className="h-8 w-8 text-gray-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">총 근무시간</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">
                  {monthSummary.totalHours.toFixed(1)}시간
                </p>
              </div>
              <Clock className="h-8 w-8 text-gray-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">평균 근무시간</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">
                  {monthSummary.averageHours.toFixed(1)}시간
                </p>
              </div>
              <Clock className="h-8 w-8 text-gray-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">지각</p>
                <p className="text-2xl font-semibold text-yellow-600 mt-1">
                  {monthSummary.lateDays}일
                </p>
              </div>
              <Clock className="h-8 w-8 text-yellow-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">결근</p>
                <p className="text-2xl font-semibold text-red-600 mt-1">
                  {monthSummary.absentDays}일
                </p>
              </div>
              <Calendar className="h-8 w-8 text-red-400" />
            </div>
          </div>
        </div>
      )}

      {/* 출퇴근 기록 테이블 */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bagel-yellow mx-auto"></div>
            <p className="mt-4 text-gray-600">로딩 중...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-600">
              {viewMode === 'month' 
                ? `${format(selectedMonth, 'yyyy년 MM월', { locale: ko })}에는 출퇴근 기록이 없습니다.`
                : '이번 주에는 출퇴근 기록이 없습니다.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    날짜
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    매장
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    출근 시간
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    퇴근 시간
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    근무 시간
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    상태
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {records.map((record) => (
                  <tr key={record.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {format(parseISO(record.work_date), 'yyyy-MM-dd (EEE)', { locale: ko })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {record.stores?.name || '-'}
                      </div>
                      <div className="text-sm text-gray-700">
                        {record.stores?.code || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.check_in_time 
                        ? format(parseISO(record.check_in_time), 'HH:mm:ss')
                        : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.check_out_time
                        ? format(parseISO(record.check_out_time), 'HH:mm:ss')
                        : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.total_hours
                        ? formatDuration(record.total_hours)
                        : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(record.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}