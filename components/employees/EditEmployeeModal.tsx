'use client'

import { useState, useTransition } from 'react'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateEmployeeBasicInfo, updateEmployeeRole, type EmployeeEditFormData } from '@/lib/actions/employees.actions'
import type { Employee } from '@/lib/data/employees.data'

interface EditEmployeeModalProps {
  employee: Employee
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  departments: string[]
  userRole: string
}

export default function EditEmployeeModal({
  employee,
  isOpen,
  onClose,
  onSuccess,
  departments,
  userRole
}: EditEmployeeModalProps) {
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<'basic' | 'role'>('basic')
  
  // Basic info form state
  const [basicForm, setBasicForm] = useState({
    fullName: employee.profiles?.full_name || '',
    phone: employee.profiles?.phone || '',
    department: employee.department || '',
    employmentType: employee.employment_type || 'full_time',
    hourlyWage: employee.hourly_wage?.toString() || '0'
  })
  
  // Role form state
  const [roleForm, setRoleForm] = useState({
    role: employee.profiles?.role || 'employee',
    department: employee.department || ''
  })
  
  const handleBasicInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    startTransition(async () => {
      const result = await updateEmployeeBasicInfo(employee.id, {
        fullName: basicForm.fullName.trim(),
        phone: basicForm.phone.trim() || undefined,
        department: basicForm.department.trim() || undefined,
        employmentType: basicForm.employmentType as 'full_time' | 'part_time' | 'contract',
        hourlyWage: parseFloat(basicForm.hourlyWage) || undefined
      })
      
      if (result.success) {
        alert(result.message)
        onSuccess()
        onClose()
      } else {
        alert(result.error)
      }
    })
  }
  
  const handleRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    startTransition(async () => {
      const result = await updateEmployeeRole(
        employee.id,
        roleForm.role,
        roleForm.department.trim() || undefined
      )
      
      if (result.success) {
        alert(result.message)
        onSuccess()
        onClose()
      } else {
        alert(result.error)
      }
    })
  }
  
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
  
  const getAvailableRoles = () => {
    const baseRoles = ['employee', 'part_time', 'manager']
    
    if (userRole === 'super_admin') {
      return [...baseRoles, 'admin', 'super_admin']
    } else if (userRole === 'admin') {
      return [...baseRoles, 'admin']
    } else {
      return baseRoles
    }
  }
  
  const resetForm = () => {
    setBasicForm({
      fullName: employee.profiles?.full_name || '',
      phone: employee.profiles?.phone || '',
      department: employee.department || '',
      employmentType: employee.employment_type || 'full_time',
      hourlyWage: employee.hourly_wage?.toString() || '0'
    })
    
    setRoleForm({
      role: employee.profiles?.role || 'employee',
      department: employee.department || ''
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose()
        resetForm()
      }
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>직원 정보 수정</DialogTitle>
          <DialogDescription>
            {employee.profiles?.full_name || '이름 없음'} ({employee.employee_number})의 정보를 수정합니다.
          </DialogDescription>
        </DialogHeader>
        
        {/* Tab Navigation */}
        <div className="flex space-x-1 border-b">
          <button
            onClick={() => setActiveTab('basic')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === 'basic'
                ? 'border-bagel-yellow text-bagel-yellow'
                : 'border-transparent text-gray-700 hover:text-gray-700'
            }`}
          >
            기본 정보
          </button>
          <button
            onClick={() => setActiveTab('role')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === 'role'
                ? 'border-bagel-yellow text-bagel-yellow'
                : 'border-transparent text-gray-700 hover:text-gray-700'
            }`}
          >
            역할 & 부서
          </button>
        </div>
        
        {/* Basic Info Tab */}
        {activeTab === 'basic' && (
          <form onSubmit={handleBasicInfoSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">이름 *</Label>
                <Input
                  id="fullName"
                  value={basicForm.fullName}
                  onChange={(e) => setBasicForm({ ...basicForm, fullName: e.target.value })}
                  required
                  disabled={isPending}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">연락처</Label>
                <Input
                  id="phone"
                  value={basicForm.phone}
                  onChange={(e) => setBasicForm({ ...basicForm, phone: e.target.value })}
                  placeholder="010-1234-5678"
                  disabled={isPending}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="department">부서</Label>
              <Select
                value={basicForm.department || 'none'}
                onValueChange={(value) => setBasicForm({ ...basicForm, department: value === 'none' ? '' : value })}
                disabled={isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="부서를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">부서 없음</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                  <SelectItem value="매장운영">매장운영</SelectItem>
                  <SelectItem value="제조">제조</SelectItem>
                  <SelectItem value="서비스">서비스</SelectItem>
                  <SelectItem value="관리">관리</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employmentType">고용 형태</Label>
                <Select
                  value={basicForm.employmentType}
                  onValueChange={(value) => setBasicForm({ ...basicForm, employmentType: value })}
                  disabled={isPending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">정규직</SelectItem>
                    <SelectItem value="part_time">파트타임</SelectItem>
                    <SelectItem value="contract">계약직</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="hourlyWage">시급 (원)</Label>
                <Input
                  id="hourlyWage"
                  type="number"
                  value={basicForm.hourlyWage}
                  onChange={(e) => setBasicForm({ ...basicForm, hourlyWage: e.target.value })}
                  min="0"
                  step="100"
                  disabled={isPending}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isPending}
              >
                취소
              </Button>
              <Button
                type="submit"
                className="bg-bagel-yellow hover:bg-yellow-600 text-black"
                disabled={isPending}
              >
                {isPending ? '저장 중...' : '기본 정보 저장'}
              </Button>
            </DialogFooter>
          </form>
        )}
        
        {/* Role Tab */}
        {activeTab === 'role' && (
          <form onSubmit={handleRoleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role">역할 *</Label>
              <Select
                value={roleForm.role}
                onValueChange={(value) => setRoleForm({ ...roleForm, role: value })}
                disabled={isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableRoles().map((role) => (
                    <SelectItem key={role} value={role}>
                      {getRoleLabel(role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="roleDepartment">부서</Label>
              <Select
                value={roleForm.department || 'none'}
                onValueChange={(value) => setRoleForm({ ...roleForm, department: value === 'none' ? '' : value })}
                disabled={isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="부서를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">부서 없음</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                  <SelectItem value="매장운영">매장운영</SelectItem>
                  <SelectItem value="제조">제조</SelectItem>
                  <SelectItem value="서비스">서비스</SelectItem>
                  <SelectItem value="관리">관리</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {userRole === 'manager' && ['admin', 'super_admin'].includes(roleForm.role) && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-600">
                  ⚠️ 매니저는 관리자 권한을 부여할 수 없습니다.
                </p>
              </div>
            )}
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isPending}
              >
                취소
              </Button>
              <Button
                type="submit"
                className="bg-bagel-yellow hover:bg-yellow-600 text-black"
                disabled={isPending || (userRole === 'manager' && ['admin', 'super_admin'].includes(roleForm.role))}
              >
                {isPending ? '저장 중...' : '역할 저장'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}