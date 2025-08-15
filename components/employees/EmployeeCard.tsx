'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { 
  User, 
  Mail, 
  Phone, 
  Building2, 
  Calendar,
  MoreVertical,
  Edit,
  UserCheck,
  UserX,
  BarChart3,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import type { Employee } from '@/lib/data/employees.data'

interface EmployeeCardProps {
  employee: Employee
  onEdit: (employee: Employee) => void
  onActivate: (id: string) => void
  onDeactivate: (id: string) => void
  canManage: boolean
  canViewSalary: boolean
  isPending?: boolean
}

export function EmployeeCard({
  employee,
  onEdit,
  onActivate,
  onDeactivate,
  canManage,
  canViewSalary,
  isPending = false
}: EmployeeCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

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

  const getRoleStyle = (role: string) => {
    const styles: Record<string, { bg: string; text: string; border: string }> = {
      super_admin: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
      admin: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
      manager: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
      employee: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
      part_time: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' }
    }
    return styles[role] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' }
  }

  const roleStyle = getRoleStyle(employee.profiles?.role || '')

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={`
        relative bg-white rounded-xl shadow-sm border transition-all duration-200
        ${isHovered ? 'shadow-lg border-bagel-yellow/30' : 'border-gray-200'}
        ${!employee.is_active ? 'opacity-75' : ''}
        ${isPending ? 'border-yellow-400 bg-yellow-50/30' : ''}
      `}
    >
      {/* Pending Badge */}
      {isPending && (
        <div className="absolute -top-2 -right-2 z-10">
          <div className="bg-yellow-400 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 shadow-lg">
            <Clock className="h-3 w-3" />
            승인 대기
          </div>
        </div>
      )}

      <div className="p-6">
        <div className="flex items-start justify-between">
          {/* Employee Info */}
          <div className="flex items-start space-x-4 flex-1">
            {/* Avatar */}
            <div className={`
              relative w-14 h-14 rounded-full flex items-center justify-center font-semibold text-lg
              ${employee.is_active ? 'bg-gradient-to-br from-bagel-yellow to-yellow-500 text-white' : 'bg-gray-300 text-gray-600'}
            `}>
              {employee.profiles?.full_name?.charAt(0) || '?'}
              {!employee.is_active && (
                <div className="absolute -bottom-1 -right-1 bg-red-500 rounded-full p-1">
                  <UserX className="h-3 w-3 text-white" />
                </div>
              )}
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-gray-900 truncate">
                  {employee.profiles?.full_name || '이름 없음'}
                </h3>
                <span className={`
                  px-2 py-0.5 text-xs font-medium rounded-full border
                  ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}
                `}>
                  {getRoleLabel(employee.profiles?.role || '')}
                </span>
              </div>

              {/* Contact Info */}
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-gray-400" />
                  <span className="truncate">{employee.profiles?.email}</span>
                </div>
                {employee.profiles?.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-gray-400" />
                    <span>{employee.profiles.phone}</span>
                  </div>
                )}
              </div>

              {/* Meta Info */}
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                {employee.stores?.name && (
                  <div className="flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>{employee.stores.name}</span>
                  </div>
                )}
                {employee.hire_date && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{format(new Date(employee.hire_date), 'yyyy.MM.dd', { locale: ko })}</span>
                  </div>
                )}
                {employee.department && (
                  <div className="flex items-center gap-1">
                    <span className="font-medium">{employee.department}</span>
                  </div>
                )}
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-2 mt-3">
                {employee.is_active ? (
                  <div className="flex items-center gap-1 text-xs">
                    <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                    <span className="text-green-700 font-medium">활성 상태</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-xs">
                    <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-red-700 font-medium">비활성 상태</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMenu(!showMenu)}
              className="p-2"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>

            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20"
                >
                  <button
                    onClick={() => {
                      onEdit(employee)
                      setShowMenu(false)
                    }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Edit className="h-4 w-4" />
                    정보 수정
                  </button>

                  {canViewSalary && (
                    <a
                      href={`/dashboard/salary?employee=${employee.id}`}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <BarChart3 className="h-4 w-4" />
                      급여 관리
                    </a>
                  )}

                  {canManage && (
                    <>
                      <div className="border-t my-1" />
                      {employee.is_active ? (
                        <button
                          onClick={() => {
                            onDeactivate(employee.id)
                            setShowMenu(false)
                          }}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          <UserX className="h-4 w-4" />
                          비활성화
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            onActivate(employee.id)
                            setShowMenu(false)
                          }}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-green-600 hover:bg-green-50"
                        >
                          <UserCheck className="h-4 w-4" />
                          활성화
                        </button>
                      )}
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  )
}