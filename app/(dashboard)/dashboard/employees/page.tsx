'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { 
  Users, 
  Search, 
  Filter,
  MoreVertical,
  Edit,
  Shield,
  MapPin,
  Phone,
  Mail,
  Calendar,
  UserPlus
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Employee {
  id: string
  employee_number: string
  user_id: string
  store_id: string
  is_active: boolean
  created_at: string
  profiles: {
    id: string
    full_name: string | null
    email: string
    role: string
  }
  stores: {
    id: string
    name: string
    code: string
  }
}

interface Store {
  id: string
  name: string
  code: string
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStore, setSelectedStore] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [userRole, setUserRole] = useState<string>('')
  const [userStoreId, setUserStoreId] = useState<string>('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkAuthAndLoadData()
  }, [])

  const checkAuthAndLoadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/login')
      return
    }

    // 사용자 정보 및 권한 확인
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

    // 매니저인 경우 자신의 매장 ID 가져오기
    if (profile.role === 'manager') {
      const { data: employee } = await supabase
        .from('employees')
        .select('store_id')
        .eq('user_id', user.id)
        .single()

      if (employee) {
        setUserStoreId(employee.store_id)
        setSelectedStore(employee.store_id)
      }
    }

    await Promise.all([fetchEmployees(), fetchStores()])
  }

  const fetchEmployees = async () => {
    setLoading(true)
    
    try {
      let query = supabase
        .from('employees')
        .select(`
          *,
          profiles!inner (
            id,
            full_name,
            email,
            role
          ),
          stores (
            id,
            name,
            code
          )
        `)
        .order('created_at', { ascending: false })

      // 매니저는 자기 매장 직원만 조회
      if (userRole === 'manager' && userStoreId) {
        query = query.eq('store_id', userStoreId)
      }

      const { data, error } = await query

      if (error) throw error
      setEmployees(data || [])
    } catch (error) {
      console.error('Error fetching employees:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStores = async () => {
    const { data } = await supabase
      .from('stores')
      .select('*')
      .eq('is_active', true)
      .order('name')

    setStores(data || [])
  }

  const handleStatusToggle = async (employeeId: string, currentStatus: boolean) => {
    if (!confirm(`정말로 이 직원을 ${currentStatus ? '비활성화' : '활성화'}하시겠습니까?`)) {
      return
    }

    const { error } = await supabase
      .from('employees')
      .update({ is_active: !currentStatus })
      .eq('id', employeeId)

    if (error) {
      alert('상태 변경에 실패했습니다.')
      console.error(error)
    } else {
      fetchEmployees()
    }
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

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      super_admin: 'bg-purple-100 text-purple-800',
      admin: 'bg-red-100 text-red-800',
      manager: 'bg-blue-100 text-blue-800',
      employee: 'bg-green-100 text-green-800',
      part_time: 'bg-gray-100 text-gray-800'
    }
    return colors[role] || 'bg-gray-100 text-gray-800'
  }

  // 필터링
  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = !searchTerm || 
      employee.profiles.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.profiles.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.employee_number.includes(searchTerm)

    const matchesStore = !selectedStore || employee.store_id === selectedStore
    const matchesRole = !selectedRole || employee.profiles.role === selectedRole

    return matchesSearch && matchesStore && matchesRole
  })

  if (loading) {
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
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Users className="h-8 w-8 mr-3" />
            직원 관리
          </h1>
          <p className="text-gray-600 mt-2">
            {userRole === 'manager' ? '매장 직원' : '전체 직원'} 목록을 관리합니다.
          </p>
        </div>
        {userRole !== 'manager' && (
          <Button
            onClick={() => router.push('/admin/signup-requests')}
            className="bg-bagel-yellow hover:bg-yellow-600 text-black flex items-center gap-2"
          >
            <UserPlus className="h-4 w-4" />
            가입 승인
          </Button>
        )}
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-gray-700" />
          <h2 className="text-lg font-semibold text-gray-900">필터</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              검색
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-600" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="이름, 이메일, 사번 검색"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow"
              />
            </div>
          </div>

          {userRole !== 'manager' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                매장
              </label>
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow text-gray-900 bg-white"
              >
                <option value="">전체 매장</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              직급
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow text-gray-900 bg-white"
            >
              <option value="">전체 직급</option>
              <option value="manager">매니저</option>
              <option value="employee">정직원</option>
              <option value="part_time">파트타임</option>
              {userRole === 'super_admin' && (
                <>
                  <option value="admin">관리자</option>
                  <option value="super_admin">최고관리자</option>
                </>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* 직원 목록 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  직원 정보
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  매장
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  직급
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  입사일
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEmployees.map((employee) => (
                <tr key={employee.id} className={!employee.is_active ? 'bg-gray-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {employee.profiles.full_name || '이름 없음'}
                      </div>
                      <div className="text-sm text-gray-700 flex items-center gap-1 mt-1">
                        <Mail className="h-3 w-3" />
                        {employee.profiles.email}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        사번: {employee.employee_number}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 text-gray-600 mr-2" />
                      <span className="text-sm text-gray-900">
                        {employee.stores?.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleColor(employee.profiles.role)}`}>
                      {getRoleLabel(employee.profiles.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 text-gray-600 mr-2" />
                      {format(new Date(employee.created_at), 'yyyy-MM-dd', { locale: ko })}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {employee.is_active ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        활성
                      </span>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                        비활성
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => router.push(`/dashboard/employees/${employee.id}`)}
                        className="text-bagel-yellow hover:text-yellow-600"
                        title="상세 보기"
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                      {(userRole === 'super_admin' || userRole === 'admin') && (
                        <button
                          onClick={() => handleStatusToggle(employee.id, employee.is_active)}
                          className={employee.is_active ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}
                          title={employee.is_active ? '비활성화' : '활성화'}
                        >
                          <Shield className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredEmployees.length === 0 && (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-700">직원이 없습니다.</p>
          </div>
        )}
      </div>

      {/* 통계 */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-700">전체 직원</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {employees.length}명
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-700">활성 직원</h3>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {employees.filter(e => e.is_active).length}명
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-700">매니저</h3>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            {employees.filter(e => e.profiles.role === 'manager').length}명
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-700">파트타임</h3>
          <p className="text-2xl font-bold text-gray-600 mt-1">
            {employees.filter(e => e.profiles.role === 'part_time').length}명
          </p>
        </div>
      </div>
    </div>
  )
}