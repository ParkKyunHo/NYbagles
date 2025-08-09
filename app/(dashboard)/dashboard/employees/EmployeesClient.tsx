'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
  UserPlus,
  RefreshCw,
  BarChart3,
  Building2,
  UserCheck,
  UserX
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { deactivateEmployee, activateEmployee } from '@/lib/actions/employees.actions'
import type { Employee } from '@/lib/data/employees.data'
import type { Store } from '@/lib/data/products.data'

interface EmployeesClientProps {
  initialEmployees: Employee[]
  stats: {
    total: number
    active: number
    byRole: Record<string, number>
    byDepartment: Record<string, number>
    newThisMonth: number
  }
  stores: Store[]
  departments: string[]
  user: {
    id: string
    role: string
    storeId: string | null
    storeName: string
  }
  permissions: {
    canManageEmployees: boolean
    canEditEmployees: boolean
    canViewSalary: boolean
  }
  filters: {
    search: string
    store: string
    role: string
    department: string
    status: string
  }
}

export default function EmployeesClient({
  initialEmployees,
  stats,
  stores,
  departments,
  user,
  permissions,
  filters: initialFilters
}: EmployeesClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null)
  
  // 필터 상태
  const [searchTerm, setSearchTerm] = useState(initialFilters.search)
  const [selectedStore, setSelectedStore] = useState(initialFilters.store)
  const [selectedRole, setSelectedRole] = useState(initialFilters.role)
  const [selectedDepartment, setSelectedDepartment] = useState(initialFilters.department)
  const [selectedStatus, setSelectedStatus] = useState(initialFilters.status)
  
  // 필터 적용
  const handleFilter = () => {
    startTransition(() => {
      const params = new URLSearchParams()
      if (searchTerm) params.set('search', searchTerm)
      if (selectedStore && user.role !== 'manager') params.set('store', selectedStore)
      if (selectedRole) params.set('role', selectedRole)
      if (selectedDepartment) params.set('department', selectedDepartment)
      if (selectedStatus) params.set('status', selectedStatus)
      
      router.push(`/dashboard/employees?${params.toString()}`)
    })
  }
  
  // 새로고침
  const handleRefresh = () => {
    startTransition(() => {
      router.refresh()
    })
  }
  
  // 직원 비활성화
  const handleDeactivate = async (employeeId: string) => {
    if (!confirm('이 직원을 비활성화하시겠습니까? 로그인이 차단됩니다.')) {
      return
    }
    
    startTransition(async () => {
      const result = await deactivateEmployee(employeeId)
      
      if (result.success) {
        alert(result.message)
        router.refresh()
      } else {
        alert(result.error)
      }
    })
  }
  
  // 직원 활성화
  const handleActivate = async (employeeId: string) => {
    startTransition(async () => {
      const result = await activateEmployee(employeeId)
      
      if (result.success) {
        alert(result.message)
        router.refresh()
      } else {
        alert(result.error)
      }
    })
  }
  
  // 역할 라벨
  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      super_admin: '최고 관리자',
      admin: '관리자',
      manager: '매니저',
      employee: '정직원',
      part_time: '파트타임'
    }
    return labels[role] || role
  }
  
  // 역할 색상
  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      super_admin: 'bg-purple-100 text-purple-800',
      admin: 'bg-blue-100 text-blue-800',
      manager: 'bg-green-100 text-green-800',
      employee: 'bg-gray-100 text-gray-800',
      part_time: 'bg-yellow-100 text-yellow-800'
    }
    return colors[role] || 'bg-gray-100 text-gray-800'
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">직원 관리</h1>
          <p className="text-gray-900 mt-2">
            {user.role === 'manager' ? `${user.storeName} 직원 현황` : '전체 직원을 관리합니다.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleRefresh}
            disabled={isPending}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isPending ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
          {permissions.canManageEmployees && (
            <Link href="/dashboard/employee-requests">
              <Button className="bg-bagel-yellow hover:bg-yellow-600 text-black">
                <UserPlus className="h-4 w-4 mr-2" />
                직원 등록
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">전체 직원</p>
              <p className="text-2xl font-bold">{stats.total}명</p>
            </div>
            <Users className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">활성 직원</p>
              <p className="text-2xl font-bold">{stats.active}명</p>
            </div>
            <UserCheck className="h-8 w-8 text-green-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">비활성 직원</p>
              <p className="text-2xl font-bold">{stats.total - stats.active}명</p>
            </div>
            <UserX className="h-8 w-8 text-red-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">이달 신규</p>
              <p className="text-2xl font-bold">{stats.newThisMonth}명</p>
            </div>
            <BarChart3 className="h-8 w-8 text-yellow-500" />
          </div>
        </div>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-gray-900" />
          <h2 className="text-lg font-semibold">필터</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="이름, 이메일 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFilter()}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow text-gray-900"
            />
          </div>
          
          {user.role !== 'manager' && (
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow text-gray-900 bg-white"
            >
              <option value="">모든 매장</option>
              {stores.map(store => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
          )}
          
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow text-gray-900 bg-white"
          >
            <option value="">모든 역할</option>
            <option value="manager">매니저</option>
            <option value="employee">정직원</option>
            <option value="part_time">파트타임</option>
          </select>
          
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow text-gray-900 bg-white"
          >
            <option value="">모든 부서</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
          
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow text-gray-900 bg-white"
          >
            <option value="active">활성</option>
            <option value="inactive">비활성</option>
          </select>
          
          <Button
            onClick={handleFilter}
            disabled={isPending}
            className="bg-bagel-yellow hover:bg-yellow-600 text-black"
          >
            필터 적용
          </Button>
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
                  역할
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  매장
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  부서
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
              {initialEmployees.map((employee) => (
                <tr key={employee.id} className={!employee.is_active ? 'bg-gray-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-gray-300 rounded-full flex items-center justify-center">
                        <span className="text-gray-700 font-medium">
                          {employee.profiles?.full_name?.charAt(0) || '?'}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {employee.profiles?.full_name || '이름 없음'}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {employee.profiles?.email}
                        </div>
                        {employee.profiles?.phone && (
                          <div className="text-sm text-gray-500 flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {employee.profiles.phone}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleColor(employee.profiles?.role || '')}`}>
                      {getRoleLabel(employee.profiles?.role || '')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {employee.stores?.name || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {employee.department || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(employee.hire_date), 'yyyy-MM-dd', { locale: ko })}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {employee.is_active ? (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        활성
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                        비활성
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="relative inline-block text-left">
                      <button
                        onClick={() => setExpandedMenu(expandedMenu === employee.id ? null : employee.id)}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        <MoreVertical className="h-5 w-5" />
                      </button>
                      
                      {expandedMenu === employee.id && (
                        <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                          <div className="py-1">
                            <Link href={`/dashboard/employees/${employee.id}`}>
                              <button className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full">
                                <Edit className="h-4 w-4 mr-2" />
                                상세 정보
                              </button>
                            </Link>
                            {permissions.canViewSalary && (
                              <Link href={`/dashboard/salary?employee=${employee.id}`}>
                                <button className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full">
                                  <BarChart3 className="h-4 w-4 mr-2" />
                                  급여 관리
                                </button>
                              </Link>
                            )}
                            {permissions.canManageEmployees && (
                              <>
                                {employee.is_active ? (
                                  <button
                                    onClick={() => handleDeactivate(employee.id)}
                                    className="flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full"
                                  >
                                    <UserX className="h-4 w-4 mr-2" />
                                    비활성화
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleActivate(employee.id)}
                                    className="flex items-center px-4 py-2 text-sm text-green-600 hover:bg-green-50 w-full"
                                  >
                                    <UserCheck className="h-4 w-4 mr-2" />
                                    활성화
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {initialEmployees.length === 0 && (
          <div className="text-center py-12">
            <Users className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-700">등록된 직원이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  )
}