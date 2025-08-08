'use client'

import { useAuthCheck } from '@/hooks/useAuthCheck'
import { SystemAdminDashboard } from './SystemAdminDashboard'
import { AdminDashboard } from './AdminDashboard'
import { ManagerDashboard } from './ManagerDashboard'
import { EmployeeDashboard } from './EmployeeDashboard'
import { LoadingSpinner } from '@/components/common'
import { useState } from 'react'

export function DashboardRouter() {
  const { loading, userRole, isSuperAdmin } = useAuthCheck()
  const [viewAsRole, setViewAsRole] = useState<string | null>(null)

  if (loading) {
    return <LoadingSpinner />
  }

  // 시스템 관리자는 다른 역할로 전환 가능
  const effectiveRole = viewAsRole || userRole

  const renderDashboard = () => {
    switch (effectiveRole) {
      case 'super_admin':
        return <SystemAdminDashboard />
      case 'admin':
        return <AdminDashboard />
      case 'manager':
        return <ManagerDashboard />
      case 'employee':
      case 'part_time':
        return <EmployeeDashboard />
      default:
        return <EmployeeDashboard />
    }
  }

  return (
    <div>
      {isSuperAdmin && (
        <div className="mb-6 p-4 bg-gray-100 rounded-lg">
          <div className="flex items-center gap-4">
            <span className="font-medium">대시보드 보기:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setViewAsRole(null)}
                className={`px-3 py-1 rounded ${!viewAsRole ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              >
                시스템 관리자
              </button>
              <button
                onClick={() => setViewAsRole('admin')}
                className={`px-3 py-1 rounded ${viewAsRole === 'admin' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              >
                관리자
              </button>
              <button
                onClick={() => setViewAsRole('manager')}
                className={`px-3 py-1 rounded ${viewAsRole === 'manager' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              >
                매니저
              </button>
              <button
                onClick={() => setViewAsRole('employee')}
                className={`px-3 py-1 rounded ${viewAsRole === 'employee' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              >
                직원
              </button>
            </div>
          </div>
        </div>
      )}
      
      {renderDashboard()}
    </div>
  )
}