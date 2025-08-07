'use client'

import { useState, useEffect } from 'react'
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
import { useAuthCheck } from '@/hooks/useAuthCheck'
import { useRouter } from 'next/navigation'

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
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStore, setSelectedStore] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const router = useRouter()
  const supabase = createClient()
  
  // 권한 체크 훅 사용
  const { 
    loading, 
    userRole, 
    storeId: userStoreId,
    isManager,
    isAdmin,
    isSuperAdmin
  } = useAuthCheck({
    requiredRoles: ['super_admin', 'admin', 'manager'],
    redirectTo: '/dashboard'
  })

  useEffect(() => {
    if (!loading && (isAdmin || isManager || isSuperAdmin)) {
      loadData()
    }
  }, [loading, isAdmin, isManager, isSuperAdmin])

  const loadData = async () => {
    // 매니저인 경우 자신의 매장으로 필터 설정
    if (userRole === 'manager' && userStoreId) {
      setSelectedStore(userStoreId)
    }
    
    await Promise.all([
      fetchEmployees(userRole === 'manager' && userStoreId ? userStoreId : undefined),
      fetchStores()
    ])
  }

  const fetchEmployees = async (storeFilter?: string) => {
    try {
      let query = supabase
        .from('employees')
        .select(`
          id,
          employee_number,
          user_id,
          store_id,
          is_active,
          created_at,
          profiles!employees_user_id_fkey (
            id,
            full_name,
            email,
            role
          ),
          stores!employees_store_id_fkey (
            id,
            name,
            code
          )
        `)
        .eq('is_active', true)

      // 매니저는 자신의 매장 직원만 조회
      if (storeFilter) {
        query = query.eq('store_id', storeFilter)
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching employees:', error)
      } else {
        setEmployees(data || [])
      }
    } catch (error) {
      console.error('Error fetching employees:', error)
    }
  }

  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name')

      if (error) {
        console.error('Error fetching stores:', error)
      } else {
        setStores(data || [])
      }
    } catch (error) {
      console.error('Error fetching stores:', error)
    }
  }

  const handleRoleChange = async (employeeId: string, newRole: string) => {
    const employee = employees.find(e => e.id === employeeId)
    if (!employee) return

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', employee.user_id)

    if (error) {
      console.error('Error updating role:', error)
      alert('역할 변경 중 오류가 발생했습니다.')
    } else {
      await fetchEmployees(userRole === 'manager' ? userStoreId : undefined)
      alert('역할이 변경되었습니다.')
    }
  }

  const handleDeactivate = async (employeeId: string) => {
    if (!confirm('정말로 이 직원을 비활성화하시겠습니까?')) return

    const { error } = await supabase
      .from('employees')
      .update({ is_active: false })
      .eq('id', employeeId)

    if (error) {
      console.error('Error deactivating employee:', error)
      alert('직원 비활성화 중 오류가 발생했습니다.')
    } else {
      await fetchEmployees(userRole === 'manager' ? userStoreId : undefined)
      alert('직원이 비활성화되었습니다.')
    }
  }

  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = !searchTerm || 
      employee.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.employee_number.includes(searchTerm)
    
    const matchesStore = !selectedStore || employee.store_id === selectedStore
    const matchesRole = !selectedRole || employee.profiles?.role === selectedRole
    
    return matchesSearch && matchesStore && matchesRole
  })

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin': return 'bg-purple-100 text-purple-800'
      case 'admin': return 'bg-red-100 text-red-800'
      case 'manager': return 'bg-blue-100 text-blue-800'
      case 'employee': return 'bg-green-100 text-green-800'
      case 'part_time': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'super_admin': return '시스템 관리자'
      case 'admin': return '관리자'
      case 'manager': return '매니저'
      case 'employee': return '정직원'
      case 'part_time': return '파트타임'
      default: return role
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-bagel-yellow"></div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">직원 관리</h1>
          <p className="mt-2 text-sm text-gray-700">
            전체 {filteredEmployees.length}명의 직원
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Button onClick={() => router.push('/dashboard/employee-requests')}>
            <UserPlus className="w-4 h-4 mr-2" />
            가입 요청 관리
          </Button>
        </div>
      </div>

      {/* 필터 섹션 */}
      <div className="mt-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="이름, 이메일, 사번으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-bagel-yellow"
            />
          </div>
        </div>
        
        {/* 매니저가 아닌 경우에만 매장 필터 표시 */}
        {userRole !== 'manager' && (
          <select
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-bagel-yellow"
          >
            <option value="">모든 매장</option>
            {stores.map(store => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        )}
        
        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-bagel-yellow"
        >
          <option value="">모든 역할</option>
          <option value="manager">매니저</option>
          <option value="employee">정직원</option>
          <option value="part_time">파트타임</option>
        </select>
      </div>

      {/* 직원 목록 */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredEmployees.map((employee) => (
          <div key={employee.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900">
                  {employee.profiles?.full_name || '이름 없음'}
                </h3>
                <p className="text-sm text-gray-500">#{employee.employee_number}</p>
              </div>
              <div className="relative">
                <button className="p-1 rounded-full hover:bg-gray-100">
                  <MoreVertical className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center text-sm">
                <Shield className="w-4 h-4 mr-2 text-gray-400" />
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(employee.profiles?.role || '')}`}>
                  {getRoleDisplayName(employee.profiles?.role || '')}
                </span>
              </div>
              
              <div className="flex items-center text-sm text-gray-600">
                <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                {employee.stores?.name}
              </div>
              
              <div className="flex items-center text-sm text-gray-600">
                <Mail className="w-4 h-4 mr-2 text-gray-400" />
                {employee.profiles?.email}
              </div>
              
              <div className="flex items-center text-sm text-gray-600">
                <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                {format(new Date(employee.created_at), 'yyyy년 MM월 dd일', { locale: ko })}
              </div>
            </div>

            {(isSuperAdmin || isAdmin) && (
              <div className="mt-4 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(`/dashboard/employees/${employee.id}`)}
                >
                  <Edit className="w-4 h-4 mr-1" />
                  상세
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDeactivate(employee.id)}
                  className="text-red-600 hover:bg-red-50"
                >
                  비활성화
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredEmployees.length === 0 && (
        <div className="mt-8 text-center py-12">
          <Users className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">직원이 없습니다</h3>
          <p className="mt-1 text-sm text-gray-500">
            검색 조건에 맞는 직원이 없습니다.
          </p>
        </div>
      )}
    </div>
  )
}