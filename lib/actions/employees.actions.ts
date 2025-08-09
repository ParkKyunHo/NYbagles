'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server-admin'
import { getAuthUser } from '@/lib/auth/server-auth'
import { redirect } from 'next/navigation'

export interface CreateEmployeeInput {
  email: string
  fullName: string
  role: 'employee' | 'part_time' | 'manager' | 'admin'
  storeId: string
  employeeNumber: string
  hourlyWage?: number
  employmentType?: 'full_time' | 'part_time' | 'contract'
  department?: string
  hireDate: string
  phone?: string
  bankAccount?: {
    bankName: string
    accountNumber: string
    accountHolder: string
  }
  emergencyContact?: {
    name: string
    relationship: string
    phone: string
  }
}

export interface UpdateEmployeeInput extends Partial<CreateEmployeeInput> {
  id: string
  isActive?: boolean
}

/**
 * 직원 생성 Server Action
 * 트랜잭션으로 profiles와 employees 테이블 동시 생성
 */
export async function createEmployee(input: CreateEmployeeInput) {
  const user = await getAuthUser()
  const adminClient = createAdminClient()
  
  // 권한 체크
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    throw new Error('직원 등록 권한이 없습니다')
  }
  
  // 매니저는 자신의 매장 직원만 등록 가능
  if (user.role === 'manager' && input.storeId !== user.storeId) {
    throw new Error('다른 매장의 직원을 등록할 수 없습니다')
  }
  
  // 매니저는 관리자 권한 부여 불가
  if (user.role === 'manager' && ['admin', 'super_admin'].includes(input.role)) {
    throw new Error('관리자 권한을 부여할 수 없습니다')
  }
  
  try {
    // 1. Auth 사용자 생성
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: input.email,
      password: Math.random().toString(36).slice(-8), // 임시 비밀번호
      email_confirm: true
    })
    
    if (authError) throw authError
    
    // 2. Profile 생성
    const { error: profileError } = await adminClient
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: input.email,
        full_name: input.fullName,
        role: input.role,
        phone: input.phone,
        store_id: input.storeId
      })
    
    if (profileError) {
      // Profile 생성 실패 시 Auth 사용자 삭제
      await adminClient.auth.admin.deleteUser(authData.user.id)
      throw profileError
    }
    
    // 3. Employee 레코드 생성
    const { data: employee, error: employeeError } = await adminClient
      .from('employees')
      .insert({
        user_id: authData.user.id,
        employee_number: input.employeeNumber,
        store_id: input.storeId,
        qr_code: `EMP-${input.employeeNumber}-${Date.now()}`, // QR 코드 생성
        hourly_wage: input.hourlyWage,
        employment_type: input.employmentType,
        department: input.department,
        hire_date: input.hireDate,
        bank_account: input.bankAccount,
        emergency_contact: input.emergencyContact,
        is_active: true
      })
      .select()
      .single()
    
    if (employeeError) {
      // Employee 생성 실패 시 롤백
      await adminClient.auth.admin.deleteUser(authData.user.id)
      throw employeeError
    }
    
    // 4. 비밀번호 재설정 이메일 발송
    await adminClient.auth.resetPasswordForEmail(input.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/login`
    })
    
    // 캐시 무효화
    revalidateTag('employees')
    revalidateTag('stats')
    revalidatePath('/dashboard/employees')
    
    return {
      success: true,
      employee,
      message: '직원이 등록되었습니다. 비밀번호 설정 이메일이 발송되었습니다.'
    }
  } catch (error) {
    console.error('Employee creation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '직원 등록 중 오류가 발생했습니다'
    }
  }
}

/**
 * 직원 정보 수정 Server Action
 */
export async function updateEmployee(input: UpdateEmployeeInput) {
  const user = await getAuthUser()
  const adminClient = createAdminClient()
  
  // 권한 체크
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    throw new Error('직원 정보 수정 권한이 없습니다')
  }
  
  try {
    // 기존 직원 정보 조회
    const { data: existingEmployee } = await adminClient
      .from('employees')
      .select('*, profiles!inner(*)')
      .eq('id', input.id)
      .single()
    
    if (!existingEmployee) {
      throw new Error('직원을 찾을 수 없습니다')
    }
    
    // 매니저는 자신의 매장 직원만 수정 가능
    if (user.role === 'manager' && existingEmployee.store_id !== user.storeId) {
      throw new Error('다른 매장의 직원 정보를 수정할 수 없습니다')
    }
    
    // Profile 업데이트
    if (input.fullName || input.role || input.phone) {
      const profileUpdate: any = {}
      if (input.fullName) profileUpdate.full_name = input.fullName
      if (input.role) profileUpdate.role = input.role
      if (input.phone) profileUpdate.phone = input.phone
      
      const { error: profileError } = await adminClient
        .from('profiles')
        .update(profileUpdate)
        .eq('id', existingEmployee.user_id)
      
      if (profileError) throw profileError
    }
    
    // Employee 업데이트
    const employeeUpdate: any = {}
    if (input.hourlyWage !== undefined) employeeUpdate.hourly_wage = input.hourlyWage
    if (input.employmentType) employeeUpdate.employment_type = input.employmentType
    if (input.department) employeeUpdate.department = input.department
    if (input.bankAccount) employeeUpdate.bank_account = input.bankAccount
    if (input.emergencyContact) employeeUpdate.emergency_contact = input.emergencyContact
    if (input.isActive !== undefined) employeeUpdate.is_active = input.isActive
    
    if (Object.keys(employeeUpdate).length > 0) {
      employeeUpdate.updated_at = new Date().toISOString()
      
      const { error: employeeError } = await adminClient
        .from('employees')
        .update(employeeUpdate)
        .eq('id', input.id)
      
      if (employeeError) throw employeeError
    }
    
    // 캐시 무효화
    revalidateTag('employees')
    revalidatePath('/dashboard/employees')
    revalidatePath(`/dashboard/employees/${input.id}`)
    
    return {
      success: true,
      message: '직원 정보가 수정되었습니다'
    }
  } catch (error) {
    console.error('Employee update error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '직원 정보 수정 중 오류가 발생했습니다'
    }
  }
}

/**
 * 직원 비활성화 Server Action
 */
export async function deactivateEmployee(employeeId: string) {
  const user = await getAuthUser()
  const adminClient = createAdminClient()
  
  // 권한 체크
  if (!['super_admin', 'admin'].includes(user.role)) {
    throw new Error('직원 비활성화 권한이 없습니다')
  }
  
  try {
    // 직원 비활성화
    const { error } = await adminClient
      .from('employees')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', employeeId)
    
    if (error) throw error
    
    // Auth 사용자도 비활성화 (로그인 차단)
    const { data: employee } = await adminClient
      .from('employees')
      .select('user_id')
      .eq('id', employeeId)
      .single()
    
    if (employee?.user_id) {
      await adminClient.auth.admin.updateUserById(employee.user_id, {
        ban_duration: '876000h' // 100년 차단
      })
    }
    
    // 캐시 무효화
    revalidateTag('employees')
    revalidatePath('/dashboard/employees')
    
    return {
      success: true,
      message: '직원이 비활성화되었습니다'
    }
  } catch (error) {
    console.error('Employee deactivation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '직원 비활성화 중 오류가 발생했습니다'
    }
  }
}

/**
 * 직원 재활성화 Server Action
 */
export async function activateEmployee(employeeId: string) {
  const user = await getAuthUser()
  const adminClient = createAdminClient()
  
  // 권한 체크
  if (!['super_admin', 'admin'].includes(user.role)) {
    throw new Error('직원 활성화 권한이 없습니다')
  }
  
  try {
    // 직원 활성화
    const { error } = await adminClient
      .from('employees')
      .update({
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', employeeId)
    
    if (error) throw error
    
    // Auth 사용자 차단 해제
    const { data: employee } = await adminClient
      .from('employees')
      .select('user_id')
      .eq('id', employeeId)
      .single()
    
    if (employee?.user_id) {
      await adminClient.auth.admin.updateUserById(employee.user_id, {
        ban_duration: 'none'
      })
    }
    
    // 캐시 무효화
    revalidateTag('employees')
    revalidatePath('/dashboard/employees')
    
    return {
      success: true,
      message: '직원이 활성화되었습니다'
    }
  } catch (error) {
    console.error('Employee activation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '직원 활성화 중 오류가 발생했습니다'
    }
  }
}

/**
 * 출근 체크 Server Action
 */
export async function checkIn(employeeId: string) {
  const adminClient = createAdminClient()
  
  try {
    const today = new Date().toISOString().split('T')[0]
    const currentTime = new Date().toTimeString().split(' ')[0]
    
    // 오늘 출근 기록 확인
    const { data: existingRecord } = await adminClient
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', today)
      .single()
    
    if (existingRecord?.check_in_time) {
      throw new Error('이미 출근 처리되었습니다')
    }
    
    // 출근 기록 생성 또는 업데이트
    const { error } = await adminClient
      .from('attendance_records')
      .upsert({
        employee_id: employeeId,
        date: today,
        check_in_time: currentTime,
        status: 'present'
      })
    
    if (error) throw error
    
    // 캐시 무효화
    revalidateTag('attendance')
    
    return {
      success: true,
      message: '출근 처리되었습니다',
      checkInTime: currentTime
    }
  } catch (error) {
    console.error('Check-in error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '출근 처리 중 오류가 발생했습니다'
    }
  }
}

/**
 * 퇴근 체크 Server Action
 */
export async function checkOut(employeeId: string) {
  const adminClient = createAdminClient()
  
  try {
    const today = new Date().toISOString().split('T')[0]
    const currentTime = new Date().toTimeString().split(' ')[0]
    
    // 오늘 출근 기록 확인
    const { data: existingRecord } = await adminClient
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', today)
      .single()
    
    if (!existingRecord?.check_in_time) {
      throw new Error('출근 기록이 없습니다')
    }
    
    if (existingRecord.check_out_time) {
      throw new Error('이미 퇴근 처리되었습니다')
    }
    
    // 초과 근무 시간 계산
    const checkIn = new Date(`2000-01-01T${existingRecord.check_in_time}`)
    const checkOut = new Date(`2000-01-01T${currentTime}`)
    const workedHours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)
    const overtimeHours = Math.max(0, workedHours - 8)
    
    // 퇴근 기록 업데이트
    const { error } = await adminClient
      .from('attendance_records')
      .update({
        check_out_time: currentTime,
        overtime_hours: overtimeHours
      })
      .eq('employee_id', employeeId)
      .eq('date', today)
    
    if (error) throw error
    
    // 캐시 무효화
    revalidateTag('attendance')
    
    return {
      success: true,
      message: '퇴근 처리되었습니다',
      checkOutTime: currentTime,
      workedHours: workedHours.toFixed(1),
      overtimeHours: overtimeHours.toFixed(1)
    }
  } catch (error) {
    console.error('Check-out error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '퇴근 처리 중 오류가 발생했습니다'
    }
  }
}

/**
 * 급여 계산 Server Action
 */
export async function calculateSalary(
  employeeId: string,
  year: number,
  month: number
) {
  const user = await getAuthUser()
  const adminClient = createAdminClient()
  
  // 권한 체크
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    throw new Error('급여 계산 권한이 없습니다')
  }
  
  try {
    // 직원 정보 조회
    const { data: employee } = await adminClient
      .from('employees')
      .select('*')
      .eq('id', employeeId)
      .single()
    
    if (!employee) {
      throw new Error('직원을 찾을 수 없습니다')
    }
    
    // 해당 월의 근무 기록 조회
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0]
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]
    
    const { data: attendanceRecords } = await adminClient
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('date', startDate)
      .lte('date', endDate)
    
    // 근무 시간 계산
    let totalHours = 0
    let overtimeHours = 0
    
    attendanceRecords?.forEach(record => {
      if (record.check_in_time && record.check_out_time) {
        const checkIn = new Date(`2000-01-01T${record.check_in_time}`)
        const checkOut = new Date(`2000-01-01T${record.check_out_time}`)
        const hours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)
        totalHours += Math.min(hours, 8) // 정규 근무 시간
        overtimeHours += record.overtime_hours || 0
      }
    })
    
    // 급여 계산
    const hourlyWage = employee.hourly_wage || 0
    const baseAmount = totalHours * hourlyWage
    const overtimeAmount = overtimeHours * hourlyWage * 1.5 // 초과수당 150%
    const totalAmount = baseAmount + overtimeAmount
    
    // 급여 계산 레코드 생성
    const { data: salaryRecord, error } = await adminClient
      .from('salary_calculations')
      .upsert({
        employee_id: employeeId,
        month: `${year}-${String(month).padStart(2, '0')}`,
        base_hours: totalHours,
        overtime_hours: overtimeHours,
        base_amount: baseAmount,
        overtime_amount: overtimeAmount,
        deductions: 0,
        total_amount: totalAmount,
        payment_status: 'pending'
      })
      .select()
      .single()
    
    if (error) throw error
    
    // 캐시 무효화
    revalidateTag('salary')
    
    return {
      success: true,
      salaryRecord,
      message: '급여가 계산되었습니다'
    }
  } catch (error) {
    console.error('Salary calculation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '급여 계산 중 오류가 발생했습니다'
    }
  }
}