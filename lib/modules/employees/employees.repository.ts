/**
 * Employees Repository
 * 직원 데이터 접근 계층 - 데이터베이스 작업 격리
 */

import { Injectable, Cacheable, Log } from '@/lib/core/decorators'
import { ServiceScope } from '@/lib/core/types'
import { createAdminClient } from '@/lib/supabase/server-admin'
import { SupabaseClient } from '@supabase/supabase-js'

export interface Employee {
  id: string
  email: string
  name: string
  phone?: string
  role: 'super_admin' | 'admin' | 'manager' | 'employee' | 'part_time'
  store_id: string
  department?: string
  position?: string
  hourly_rate: number
  is_active: boolean
  created_at: string
  updated_at: string
  profile_id?: string
}

export interface EmployeeFilter {
  storeId?: string
  department?: string
  role?: string
  isActive?: boolean
  search?: string
  limit?: number
  offset?: number
}

export interface CreateEmployeeRequest {
  email: string
  password: string
  name: string
  phone?: string
  role: 'super_admin' | 'admin' | 'manager' | 'employee' | 'part_time'
  store_id: string
  department?: string
  position?: string
  hourly_rate: number
  employment_type?: 'full_time' | 'part_time' | 'contract'
}

export interface UpdateEmployeeRequest {
  name?: string
  phone?: string
  role?: 'super_admin' | 'admin' | 'manager' | 'employee' | 'part_time'
  department?: string
  position?: string
  hourly_rate?: number
  employment_type?: 'full_time' | 'part_time' | 'contract'
  is_active?: boolean
}

export interface AttendanceRecord {
  id: string
  employee_id: string
  check_in: string
  check_out?: string
  hours_worked?: number
  overtime_hours?: number
  created_at: string
}

export interface SalaryCalculation {
  id: string
  employee_id: string
  period_start: string
  period_end: string
  regular_hours: number
  overtime_hours: number
  regular_pay: number
  overtime_pay: number
  total_pay: number
  status: 'pending' | 'approved' | 'paid'
  created_at: string
}

export interface EmployeeStats {
  total: number
  active: number
  inactive: number
  byRole: Record<string, number>
  byDepartment: Record<string, number>
  avgHourlyRate: number
}

@Injectable({ scope: ServiceScope.SINGLETON })
export class EmployeesRepository {
  private supabase: SupabaseClient

  constructor() {
    this.supabase = createAdminClient()
  }

  /**
   * Get employees list with filters
   */
  async getEmployees(filter: EmployeeFilter): Promise<{
    data: Employee[]
    total: number
  }> {
    let query = this.supabase
      .from('employees')
      .select('*', { count: 'exact' })

    // Apply filters
    if (filter.storeId) {
      query = query.eq('store_id', filter.storeId)
    }
    if (filter.department) {
      query = query.eq('department', filter.department)
    }
    if (filter.role) {
      query = query.eq('role', filter.role)
    }
    if (filter.isActive !== undefined) {
      query = query.eq('is_active', filter.isActive)
    }
    if (filter.search) {
      query = query.or(`name.ilike.%${filter.search}%,email.ilike.%${filter.search}%`)
    }

    // Apply pagination
    const limit = filter.limit || 50
    const offset = filter.offset || 0
    query = query.range(offset, offset + limit - 1)
    query = query.order('name', { ascending: true })

    const { data, error, count } = await query

    if (error) {
      throw new Error(`Failed to fetch employees: ${error.message}`)
    }

    return {
      data: data || [],
      total: count || 0
    }
  }

  /**
   * Get single employee by ID
   */
  async getEmployeeById(id: string): Promise<Employee | null> {
    const { data, error } = await this.supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // Not found
      }
      throw new Error(`Failed to fetch employee: ${error.message}`)
    }

    return data as Employee
  }

  /**
   * Get employee by email
   */
  async getEmployeeByEmail(email: string): Promise<Employee | null> {
    const { data, error } = await this.supabase
      .from('employees')
      .select('*')
      .eq('email', email)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // Not found
      }
      throw new Error(`Failed to fetch employee by email: ${error.message}`)
    }

    return data as Employee
  }

  /**
   * Create a new employee (with Auth user and Profile)
   */
  async createEmployee(data: CreateEmployeeRequest): Promise<Employee> {
    // Transaction-like behavior: Create auth user, profile, then employee
    
    // 1. Create auth user
    const { data: authData, error: authError } = await this.supabase.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true
    })

    if (authError || !authData.user) {
      throw new Error(`Failed to create auth user: ${authError?.message}`)
    }

    try {
      // 2. Create profile
      const { error: profileError } = await this.supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: data.email,
          name: data.name,
          role: data.role,
          store_id: data.store_id,
          updated_at: new Date().toISOString()
        })

      if (profileError) {
        // Rollback auth user creation
        await this.supabase.auth.admin.deleteUser(authData.user.id)
        throw new Error(`Failed to create profile: ${profileError.message}`)
      }

      // 3. Create employee record
      const { data: employee, error: employeeError } = await this.supabase
        .from('employees')
        .insert({
          email: data.email,
          name: data.name,
          phone: data.phone,
          role: data.role,
          store_id: data.store_id,
          department: data.department,
          position: data.position,
          hourly_rate: data.hourly_rate,
          employment_type: data.employment_type || 'full_time',
          is_active: true,
          profile_id: authData.user.id
        })
        .select()
        .single()

      if (employeeError) {
        // Rollback auth user creation
        await this.supabase.auth.admin.deleteUser(authData.user.id)
        throw new Error(`Failed to create employee: ${employeeError.message}`)
      }

      return employee as Employee
    } catch (error) {
      // Cleanup on any error
      try {
        await this.supabase.auth.admin.deleteUser(authData.user.id)
      } catch (cleanupError) {
        console.error('Failed to cleanup auth user:', cleanupError)
      }
      throw error
    }
  }

  /**
   * Update an employee
   */
  async updateEmployee(
    id: string,
    data: UpdateEmployeeRequest
  ): Promise<Employee> {
    const existing = await this.getEmployeeById(id)
    if (!existing) {
      throw new Error('Employee not found')
    }

    // Update employee record
    const { data: employee, error: employeeError } = await this.supabase
      .from('employees')
      .update({
        ...data,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (employeeError) {
      throw new Error(`Failed to update employee: ${employeeError.message}`)
    }

    // If role changed, update profile as well
    if (data.role && existing.profile_id) {
      const { error: profileError } = await this.supabase
        .from('profiles')
        .update({
          role: data.role,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.profile_id)

      if (profileError) {
        console.error('Failed to update profile role:', profileError)
      }
    }

    return employee as Employee
  }

  /**
   * Deactivate an employee
   */
  async deactivateEmployee(id: string): Promise<boolean> {
    const existing = await this.getEmployeeById(id)
    if (!existing) {
      throw new Error('Employee not found')
    }

    // Deactivate employee
    const { error: employeeError } = await this.supabase
      .from('employees')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (employeeError) {
      throw new Error(`Failed to deactivate employee: ${employeeError.message}`)
    }

    // Disable auth user login
    if (existing.profile_id) {
      const { error: authError } = await this.supabase.auth.admin.updateUserById(
        existing.profile_id,
        { ban_duration: '876000h' } // 100 years ban
      )

      if (authError) {
        console.error('Failed to disable user login:', authError)
      }
    }

    return true
  }

  /**
   * Activate an employee
   */
  async activateEmployee(id: string): Promise<boolean> {
    const existing = await this.getEmployeeById(id)
    if (!existing) {
      throw new Error('Employee not found')
    }

    // Activate employee
    const { error: employeeError } = await this.supabase
      .from('employees')
      .update({
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (employeeError) {
      throw new Error(`Failed to activate employee: ${employeeError.message}`)
    }

    // Enable auth user login
    if (existing.profile_id) {
      const { error: authError } = await this.supabase.auth.admin.updateUserById(
        existing.profile_id,
        { ban_duration: 'none' }
      )

      if (authError) {
        console.error('Failed to enable user login:', authError)
      }
    }

    return true
  }

  /**
   * Check in employee
   */
  async checkIn(employeeId: string): Promise<AttendanceRecord> {
    // Check if already checked in
    const { data: existing } = await this.supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employeeId)
      .is('check_out', null)
      .single()

    if (existing) {
      throw new Error('Employee is already checked in')
    }

    // Create new attendance record
    const { data, error } = await this.supabase
      .from('attendance_records')
      .insert({
        employee_id: employeeId,
        check_in: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to check in: ${error.message}`)
    }

    return data as AttendanceRecord
  }

  /**
   * Check out employee
   */
  async checkOut(employeeId: string): Promise<AttendanceRecord> {
    // Find active attendance record
    const { data: existing, error: findError } = await this.supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employeeId)
      .is('check_out', null)
      .single()

    if (findError || !existing) {
      throw new Error('No active check-in found')
    }

    // Calculate hours worked
    const checkIn = new Date(existing.check_in)
    const checkOut = new Date()
    const hoursWorked = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)
    const regularHours = Math.min(hoursWorked, 8)
    const overtimeHours = Math.max(0, hoursWorked - 8)

    // Update attendance record
    const { data, error } = await this.supabase
      .from('attendance_records')
      .update({
        check_out: checkOut.toISOString(),
        hours_worked: hoursWorked,
        overtime_hours: overtimeHours
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to check out: ${error.message}`)
    }

    return data as AttendanceRecord
  }

  /**
   * Get attendance records
   */
  async getAttendanceRecords(
    employeeId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<AttendanceRecord[]> {
    let query = this.supabase
      .from('attendance_records')
      .select('*')

    if (employeeId) {
      query = query.eq('employee_id', employeeId)
    }
    if (startDate) {
      query = query.gte('check_in', startDate)
    }
    if (endDate) {
      query = query.lte('check_in', endDate)
    }

    query = query.order('check_in', { ascending: false })

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch attendance records: ${error.message}`)
    }

    return data || []
  }

  /**
   * Calculate salary for employee
   */
  async calculateSalary(
    employeeId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<SalaryCalculation> {
    // Get employee details
    const employee = await this.getEmployeeById(employeeId)
    if (!employee) {
      throw new Error('Employee not found')
    }

    // Get attendance records for period
    const attendance = await this.getAttendanceRecords(employeeId, periodStart, periodEnd)

    // Calculate totals
    let totalRegularHours = 0
    let totalOvertimeHours = 0

    attendance.forEach(record => {
      if (record.hours_worked) {
        totalRegularHours += Math.min(record.hours_worked, 8)
        totalOvertimeHours += record.overtime_hours || 0
      }
    })

    const regularPay = totalRegularHours * employee.hourly_rate
    const overtimePay = totalOvertimeHours * employee.hourly_rate * 1.5
    const totalPay = regularPay + overtimePay

    // Save calculation
    const { data, error } = await this.supabase
      .from('salary_calculations')
      .insert({
        employee_id: employeeId,
        period_start: periodStart,
        period_end: periodEnd,
        regular_hours: totalRegularHours,
        overtime_hours: totalOvertimeHours,
        regular_pay: regularPay,
        overtime_pay: overtimePay,
        total_pay: totalPay,
        status: 'pending'
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to save salary calculation: ${error.message}`)
    }

    return data as SalaryCalculation
  }

  /**
   * Get salary calculations
   */
  async getSalaryCalculations(
    employeeId?: string,
    status?: string
  ): Promise<SalaryCalculation[]> {
    let query = this.supabase
      .from('salary_calculations')
      .select('*')

    if (employeeId) {
      query = query.eq('employee_id', employeeId)
    }
    if (status) {
      query = query.eq('status', status)
    }

    query = query.order('period_start', { ascending: false })

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch salary calculations: ${error.message}`)
    }

    return data || []
  }

  /**
   * Get employee statistics
   */
  async getEmployeeStats(storeId?: string): Promise<EmployeeStats> {
    let query = this.supabase
      .from('employees')
      .select('*')

    if (storeId) {
      query = query.eq('store_id', storeId)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch employee stats: ${error.message}`)
    }

    const employees = data || []

    // Calculate statistics
    const stats: EmployeeStats = {
      total: employees.length,
      active: employees.filter(e => e.is_active).length,
      inactive: employees.filter(e => !e.is_active).length,
      byRole: {},
      byDepartment: {},
      avgHourlyRate: 0
    }

    // Group by role
    employees.forEach(emp => {
      stats.byRole[emp.role] = (stats.byRole[emp.role] || 0) + 1
      if (emp.department) {
        stats.byDepartment[emp.department] = (stats.byDepartment[emp.department] || 0) + 1
      }
    })

    // Calculate average hourly rate
    if (employees.length > 0) {
      const totalRate = employees.reduce((sum, emp) => sum + emp.hourly_rate, 0)
      stats.avgHourlyRate = totalRate / employees.length
    }

    return stats
  }

  /**
   * Get departments
   */
  async getDepartments(storeId?: string): Promise<string[]> {
    let query = this.supabase
      .from('employees')
      .select('department')

    if (storeId) {
      query = query.eq('store_id', storeId)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch departments: ${error.message}`)
    }

    // Extract unique departments
    const departments = new Set(data?.map(e => e.department).filter(d => d) || [])
    return Array.from(departments).sort()
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details?: any }> {
    try {
      const { error } = await this.supabase
        .from('employees')
        .select('id')
        .limit(1)

      return {
        status: error ? 'unhealthy' : 'healthy',
        details: error ? { error: error.message } : undefined
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: (error as Error).message }
      }
    }
  }
}