'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { 
  ArrowLeft,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Shield,
  Clock,
  Edit,
  Save,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmployeeDetail {
  id: string
  employee_number: string
  user_id: string
  store_id: string
  is_active: boolean
  created_at: string
  profiles: {
    id: string
    name: string
    email: string
    role: string
  }
  stores: {
    id: string
    name: string
    code: string
    address: string
    phone: string
  }
}

interface AttendanceRecord {
  id: string
  work_date: string
  check_in_time: string
  check_out_time: string | null
  total_hours: number | null
  status: string
}

interface WorkSchedule {
  id: string
  schedule_date: string
  shift_start: string
  shift_end: string
  break_minutes: number
}

export default function EmployeeDetailPage() {
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null)
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [schedules, setSchedules] = useState<WorkSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [userRole, setUserRole] = useState<string>('')
  const [editData, setEditData] = useState({
    name: '',
    role: '',
    store_id: '',
    is_active: true
  })
  const [stores, setStores] = useState<any[]>([])
  
  const router = useRouter()
  const params = useParams()
  const employeeId = params.id as string
  const supabase = createClient()

  useEffect(() => {
    checkAuthAndLoadData()
  }, [employeeId])

  const checkAuthAndLoadData = async () => {
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
      return
    }

    setUserRole(profile.role)
    
    await Promise.all([
      fetchEmployee(),
      fetchAttendance(),
      fetchSchedules(),
      fetchStores()
    ])
  }

  const fetchEmployee = async () => {
    const { data, error } = await supabase
      .from('employees')
      .select(`
        *,
        profiles!inner (
          id,
          name,
          email,
          role
        ),
        stores (
          id,
          name,
          code,
          address,
          phone
        )
      `)
      .eq('id', employeeId)
      .single()

    if (error) {
      console.error('Error fetching employee:', error)
      router.push('/dashboard/employees')
      return
    }

    setEmployee(data)
    setEditData({
      name: data.profiles.name || '',
      role: data.profiles.role,
      store_id: data.store_id,
      is_active: data.is_active
    })
  }

  const fetchAttendance = async () => {
    const { data } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employeeId)
      .order('work_date', { ascending: false })
      .limit(30)

    setAttendanceRecords(data || [])
  }

  const fetchSchedules = async () => {
    const today = new Date()
    const { data } = await supabase
      .from('work_schedules')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('schedule_date', format(today, 'yyyy-MM-dd'))
      .order('schedule_date')
      .limit(14)

    setSchedules(data || [])
  }

  const fetchStores = async () => {
    const { data } = await supabase
      .from('stores')
      .select('*')
      .eq('is_active', true)
      .order('name')

    setStores(data || [])
    setLoading(false)
  }

  const handleSave = async () => {
    if (!employee) return

    // 프로필 업데이트
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        name: editData.name,
        role: editData.role
      })
      .eq('id', employee.user_id)

    if (profileError) {
      alert('프로필 업데이트 실패')
      console.error(profileError)
      return
    }

    // 직원 정보 업데이트
    const { error: employeeError } = await supabase
      .from('employees')
      .update({
        store_id: editData.store_id,
        is_active: editData.is_active
      })
      .eq('id', employeeId)

    if (employeeError) {
      alert('직원 정보 업데이트 실패')
      console.error(employeeError)
      return
    }

    alert('저장되었습니다.')
    setEditing(false)
    fetchEmployee()
  }

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      super_admin: '최고관리자',
      admin: '관리자',
      manager: '매니저',
      employee: '정직원',
      part_time: '파트타임'
    }
    return labels[role] || role
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      present: '정상',
      late: '지각',
      absent: '결근',
      early: '조퇴'
    }
    return labels[status] || status
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      present: 'text-green-600',
      late: 'text-yellow-600',
      absent: 'text-red-600',
      early: 'text-orange-600'
    }
    return colors[status] || 'text-gray-600'
  }

  if (loading || !employee) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bagel-yellow mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/employees')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">직원 상세 정보</h1>
            <p className="text-gray-600 mt-1">
              {employee.profiles.name} ({employee.employee_number})
            </p>
          </div>
        </div>
        {(userRole === 'super_admin' || userRole === 'admin') && (
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button
                  onClick={handleSave}
                  className="bg-bagel-yellow hover:bg-yellow-600 text-black"
                >
                  <Save className="h-4 w-4 mr-2" />
                  저장
                </Button>
                <Button
                  onClick={() => {
                    setEditing(false)
                    setEditData({
                      name: employee.profiles.name || '',
                      role: employee.profiles.role,
                      store_id: employee.store_id,
                      is_active: employee.is_active
                    })
                  }}
                  variant="secondary"
                >
                  <X className="h-4 w-4 mr-2" />
                  취소
                </Button>
              </>
            ) : (
              <Button
                onClick={() => setEditing(true)}
                variant="secondary"
              >
                <Edit className="h-4 w-4 mr-2" />
                수정
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 기본 정보 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <User className="h-5 w-5 mr-2" />
              기본 정보
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-700">이름</label>
                {editing ? (
                  <input
                    type="text"
                    value={editData.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow"
                  />
                ) : (
                  <p className="font-medium text-gray-900">{employee.profiles.name || '미등록'}</p>
                )}
              </div>

              <div>
                <label className="text-sm text-gray-700">이메일</label>
                <p className="font-medium text-gray-900 flex items-center">
                  <Mail className="h-4 w-4 mr-2 text-gray-600" />
                  {employee.profiles.email}
                </p>
              </div>

              <div>
                <label className="text-sm text-gray-700">사번</label>
                <p className="font-medium text-gray-900">{employee.employee_number}</p>
              </div>

              <div>
                <label className="text-sm text-gray-700">직급</label>
                {editing && (userRole === 'super_admin' || userRole === 'admin') ? (
                  <select
                    value={editData.role}
                    onChange={(e) => setEditData({ ...editData, role: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow"
                  >
                    <option value="employee">정직원</option>
                    <option value="part_time">파트타임</option>
                    <option value="manager">매니저</option>
                    {userRole === 'super_admin' && (
                      <>
                        <option value="admin">관리자</option>
                        <option value="super_admin">최고관리자</option>
                      </>
                    )}
                  </select>
                ) : (
                  <p className="font-medium text-gray-900 flex items-center">
                    <Shield className="h-4 w-4 mr-2 text-gray-600" />
                    {getRoleLabel(employee.profiles.role)}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm text-gray-700">소속 매장</label>
                {editing ? (
                  <select
                    value={editData.store_id}
                    onChange={(e) => setEditData({ ...editData, store_id: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow"
                  >
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="font-medium text-gray-900 flex items-center">
                    <MapPin className="h-4 w-4 mr-2 text-gray-600" />
                    {employee.stores.name}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm text-gray-700">입사일</label>
                <p className="font-medium text-gray-900 flex items-center">
                  <Calendar className="h-4 w-4 mr-2 text-gray-600" />
                  {format(new Date(employee.created_at), 'yyyy년 MM월 dd일', { locale: ko })}
                </p>
              </div>

              <div>
                <label className="text-sm text-gray-700">상태</label>
                {editing ? (
                  <select
                    value={editData.is_active ? 'active' : 'inactive'}
                    onChange={(e) => setEditData({ ...editData, is_active: e.target.value === 'active' })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow"
                  >
                    <option value="active">활성</option>
                    <option value="inactive">비활성</option>
                  </select>
                ) : (
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    employee.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {employee.is_active ? '활성' : '비활성'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 근무 기록 및 스케줄 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 최근 근무 기록 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              최근 근무 기록
            </h2>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">날짜</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">출근</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">퇴근</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">근무시간</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {attendanceRecords.map((record) => (
                    <tr key={record.id}>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {format(new Date(record.work_date), 'MM/dd (EEE)', { locale: ko })}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {record.check_in_time ? format(new Date(`2000-01-01 ${record.check_in_time}`), 'HH:mm') : '-'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {record.check_out_time ? format(new Date(`2000-01-01 ${record.check_out_time}`), 'HH:mm') : '-'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {record.total_hours ? `${record.total_hours}시간` : '-'}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <span className={getStatusColor(record.status)}>
                          {getStatusLabel(record.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {attendanceRecords.length === 0 && (
              <p className="text-center text-gray-700 py-4">근무 기록이 없습니다.</p>
            )}
          </div>

          {/* 예정된 스케줄 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              예정된 스케줄
            </h2>
            
            <div className="space-y-2">
              {schedules.map((schedule) => (
                <div key={schedule.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">
                      {format(new Date(schedule.schedule_date), 'MM월 dd일 (EEEE)', { locale: ko })}
                    </p>
                    <p className="text-sm text-gray-600">
                      {schedule.shift_start} - {schedule.shift_end}
                      {schedule.break_minutes > 0 && ` (휴게 ${schedule.break_minutes}분)`}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {schedules.length === 0 && (
              <p className="text-center text-gray-700 py-4">예정된 스케줄이 없습니다.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}