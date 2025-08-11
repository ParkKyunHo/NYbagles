import { Suspense } from 'react'
import { requireRole } from '@/lib/auth/unified-auth'
import { getEmployees, getEmployeeStats, getDepartments } from '@/lib/data/employees.data'
import { getStores } from '@/lib/data/products.data'
import { serializeRows, serializeObject } from '@/lib/utils/serialization'
import { redirect, notFound } from 'next/navigation'
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
  try {
    // 권한 체크 및 사용자 정보 가져오기
    const user = await requireRole(['super_admin', 'admin', 'manager'])
    
    // 사용자가 승인되지 않은 경우
    if (!user.isApproved) {
      console.log('[Employees Page] User not approved:', user.email)
      redirect('/pending-approval')
    }
    
    // 조직이 설정되지 않은 경우
    if (!user.organizationId) {
      console.log('[Employees Page] No organization set for user:', user.email)
      redirect('/select-organization')
    }
  
    // 매니저는 자신의 매장만 볼 수 있음 (Legacy store ID 사용)
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
    
    // 데이터가 없거나 권한이 없는 경우
    if (!employees || employees.length === 0) {
      console.log('[Employees Page] No employees found or access denied')
      // 빈 상태로 렌더링 (에러 대신)
      return (
        <Suspense fallback={<EmployeesLoading />}>
          <EmployeesClient
            initialEmployees={[]}
            stats={stats || { total: 0, active: 0, inactive: 0, byRole: {} }}
            stores={serializeRows(stores || [])}
            departments={departments || []}
            user={{
              id: user.id,
              role: user.role,
              storeId: user.storeId || null,
              storeName: user.storeName || '',
              organizationId: user.organizationId || null,
              organizationName: user.organizationName || ''
            }}
            permissions={{
              canManageEmployees: user.role === 'super_admin' || user.role === 'admin',
              canEditEmployees: ['super_admin', 'admin', 'manager'].includes(user.role),
              canViewSalary: ['super_admin', 'admin', 'manager'].includes(user.role)
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
  
    // 권한별 기능 제어
    const canManageEmployees = user.role === 'super_admin' || user.role === 'admin'
    const canEditEmployees = ['super_admin', 'admin', 'manager'].includes(user.role)
    const canViewSalary = ['super_admin', 'admin', 'manager'].includes(user.role)
    
    // 데이터 직렬화 (서버 → 클라이언트 전달용)
    const serializedEmployees = serializeRows(employees)
    const serializedStores = serializeRows(stores)
    const serializedStats = serializeObject(stats) || { total: 0, active: 0, inactive: 0, byRole: {}, byDepartment: {}, newThisMonth: 0 }
    
    return (
      <Suspense fallback={<EmployeesLoading />}>
        <EmployeesClient
          initialEmployees={serializedEmployees}
          stats={serializedStats}
          stores={serializedStores}
          departments={departments}
          user={{
            id: user.id,
            role: user.role,
            storeId: user.storeId || null,
            storeName: user.storeName || '',
            organizationId: user.organizationId || null,
            organizationName: user.organizationName || ''
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
  } catch (error: any) {
    console.error('[Employees Page] Error:', {
      message: error?.message,
      stack: error?.stack,
      code: error?.code
    })
    
    // 인증 실패는 로그인으로
    if (error?.code === 'UNAUTHENTICATED') {
      redirect('/login')
    }
    
    // 권한 없음은 403으로
    if (error?.code === 'UNAUTHORIZED') {
      redirect('/403')
    }
    
    // 그 외 에러는 error boundary로 전달
    throw error
  }
}