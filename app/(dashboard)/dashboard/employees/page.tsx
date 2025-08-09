import { Suspense } from 'react'
import { requireRole } from '@/lib/auth/server-auth'
import { getEmployees, getEmployeeStats, getDepartments } from '@/lib/data/employees.data'
import { getStores } from '@/lib/data/products.data'
import EmployeesClient from './EmployeesClient'

// 로딩 컴포넌트
function EmployeesLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

interface PageProps {
  searchParams: {
    search?: string
    store?: string
    role?: string
    department?: string
    status?: string
  }
}

export default async function EmployeesPage({ searchParams }: PageProps) {
  // 권한 체크 및 사용자 정보 가져오기
  const user = await requireRole(['super_admin', 'admin', 'manager'])
  
  // 매니저는 자신의 매장만 볼 수 있음
  const storeId = user.role === 'manager' 
    ? user.storeId 
    : searchParams.store || null
  
  // 필터 설정
  const filters = {
    storeId,
    role: searchParams.role,
    department: searchParams.department,
    isActive: searchParams.status === 'inactive' ? false : true,
    searchTerm: searchParams.search
  }
  
  // 병렬 데이터 페칭
  const [employees, stats, stores, departments] = await Promise.all([
    getEmployees(filters),
    getEmployeeStats(storeId),
    getStores(),
    getDepartments()
  ])
  
  // 권한별 기능 제어
  const canManageEmployees = user.role === 'super_admin' || user.role === 'admin'
  const canEditEmployees = ['super_admin', 'admin', 'manager'].includes(user.role)
  const canViewSalary = ['super_admin', 'admin', 'manager'].includes(user.role)
  
  return (
    <Suspense fallback={<EmployeesLoading />}>
      <EmployeesClient
        initialEmployees={employees}
        stats={stats}
        stores={stores}
        departments={departments}
        user={{
          id: user.id,
          role: user.role,
          storeId: user.storeId || null,
          storeName: user.storeName || ''
        }}
        permissions={{
          canManageEmployees,
          canEditEmployees,
          canViewSalary
        }}
        filters={{
          search: searchParams.search || '',
          store: storeId || '',
          role: searchParams.role || '',
          department: searchParams.department || '',
          status: searchParams.status || 'active'
        }}
      />
    </Suspense>
  )
}