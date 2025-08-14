/**
 * Employees Data Layer
 * 서버 컴포넌트에서 사용할 직원 데이터 페칭 함수
 * 
 * 백엔드 아키텍처 원칙:
 * - 데이터 캐싱으로 DB 부하 최소화
 * - 권한별 필터링 로직 중앙화
 * - 병렬 데이터 페칭으로 성능 최적화
 */

import { createAdminClient, createSafeAdminClient } from '@/lib/supabase/server-admin'
import { unstable_cache } from 'next/cache'
import { startOfMonth, endOfMonth } from 'date-fns'

export interface Employee {
  id: string
  employee_number: string
  user_id: string
  store_id: string
  full_name?: string // full_name comes from profiles join, make it optional
  qr_code?: string // Make optional as it might not exist
  hourly_wage?: number | null
  employment_type?: string | null
  department?: string | null
  hire_date?: string
  bank_account?: any
  emergency_contact?: any
  is_active?: boolean
  created_at: string
  updated_at?: string
  profiles?: {
    id: string
    full_name: string
    email: string
    role: string
    phone: string | null
  }
  stores?: {
    id: string
    name: string
    code: string
  }
}

export interface EmployeeFilters {
  storeId?: string | null
  orgId?: string | null
  role?: string
  isActive?: boolean
  searchTerm?: string
  department?: string
  employmentType?: string
}

export interface AttendanceRecord {
  id: string
  employee_id: string
  date: string
  check_in_time: string | null
  check_out_time: string | null
  status: 'present' | 'absent' | 'late' | 'half_day'
  overtime_hours: number
  notes: string | null
}

export interface SalaryCalculation {
  id: string
  employee_id: string
  month: string
  base_hours: number
  overtime_hours: number
  base_amount: number
  overtime_amount: number
  deductions: number
  total_amount: number
  payment_status: 'pending' | 'processing' | 'completed'
  payment_date: string | null
}

/**
 * 직원 목록 조회 (캐싱 적용)
 * 권한별 필터링 및 매장별 접근 제어 포함
 */
export const getEmployees = unstable_cache(
  async (filters: EmployeeFilters = {}): Promise<Employee[]> => {
    const adminClient = createSafeAdminClient()
    
    let query = adminClient
      .from('employees')
      .select(`
        id,
        employee_number,
        user_id,
        store_id,
        created_at,
        qr_code,
        hourly_wage,
        employment_type,
        department,
        hire_date,
        bank_account,
        emergency_contact,
        is_active,
        updated_at,
        profiles!employees_user_id_fkey (
          id,
          full_name,
          email,
          role,
          phone
        ),
        stores (
          id,
          name,
          code
        )
      `)
    
    // 필터 적용
    // org_id는 현재 테이블에 없음
    // if (filters.orgId) {
    //   query = query.eq('org_id', filters.orgId)
    // }
    
    if (filters.storeId) {
      query = query.eq('store_id', filters.storeId)
    }
    
    if (filters.role) {
      query = query.eq('profiles.role', filters.role)
    }
    
    if (filters.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive)
    }
    
    if (filters.searchTerm) {
      query = query.or(`profiles.full_name.ilike.%${filters.searchTerm}%,profiles.email.ilike.%${filters.searchTerm}%,employee_number.ilike.%${filters.searchTerm}%`)
    }
    
    if (filters.department) {
      query = query.eq('department', filters.department)
    }
    
    if (filters.employmentType) {
      query = query.eq('employment_type', filters.employmentType)
    }
    
    // 정렬: 활성 직원 우선, 최근 등록순
    query = query
      .order('is_active', { ascending: false })
      .order('created_at', { ascending: false })
    
    const { data, error } = await query
    
    if (error) {
      console.error('Error fetching employees:', error)
      throw error
    }
    
    // Transform data to match Employee interface
    const employees = (data || []).map(emp => {
      // Ensure profiles and stores are not arrays (Supabase returns single object for many-to-one)
      const profiles = Array.isArray(emp.profiles) ? emp.profiles[0] : emp.profiles
      const stores = Array.isArray(emp.stores) ? emp.stores[0] : emp.stores
      
      return {
        ...emp,
        full_name: profiles?.full_name || 'Unknown',
        profiles: profiles || undefined, // Make sure it's an object, not array
        stores: stores || undefined, // Make sure it's an object, not array
        // Fields are now directly selected from the query
        qr_code: emp.qr_code || '',
        hourly_wage: emp.hourly_wage || null,
        employment_type: emp.employment_type || null,
        department: emp.department || null,
        hire_date: emp.hire_date || emp.created_at,
        bank_account: emp.bank_account || null,
        emergency_contact: emp.emergency_contact || null,
        is_active: emp.is_active !== undefined ? emp.is_active : true,
        updated_at: emp.updated_at || emp.created_at
      }
    })
    
    return employees
  },
  ['employees'],
  {
    revalidate: 300, // 5분 캐싱
    tags: ['employees']
  }
)

/**
 * 단일 직원 상세 정보 조회
 */
export const getEmployee = unstable_cache(
  async (employeeId: string): Promise<Employee | null> => {
    const adminClient = createSafeAdminClient()
    
    const { data, error } = await adminClient
      .from('employees')
      .select(`
        id,
        employee_number,
        user_id,
        store_id,
        created_at,
        qr_code,
        hourly_wage,
        employment_type,
        department,
        hire_date,
        bank_account,
        emergency_contact,
        is_active,
        updated_at,
        profiles!employees_user_id_fkey (
          id,
          full_name,
          email,
          role,
          phone
        ),
        stores (
          id,
          name,
          code
        )
      `)
      .eq('id', employeeId)
      .single()
    
    if (error) {
      console.error('Error fetching employee:', error)
      return null
    }
    
    if (!data) return null
    
    // Transform data to match Employee interface
    // Ensure profiles is not an array (Supabase returns single object for many-to-one)
    const profiles = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles
    const stores = Array.isArray(data.stores) ? data.stores[0] : data.stores
    
    return {
      ...data,
      full_name: profiles?.full_name || 'Unknown',
      profiles: profiles || undefined, // Make sure it's an object, not array
      stores: stores || undefined, // Make sure it's an object, not array
      // Fields are now directly selected from the query
      qr_code: data.qr_code || '',
      hourly_wage: data.hourly_wage || null,
      employment_type: data.employment_type || null,
      department: data.department || null,
      hire_date: data.hire_date || data.created_at,
      bank_account: data.bank_account || null,
      emergency_contact: data.emergency_contact || null,
      is_active: data.is_active !== undefined ? data.is_active : true,
      updated_at: data.updated_at || data.created_at
    }
  },
  ['employee'],
  {
    revalidate: 300,
    tags: ['employees']
  }
)

/**
 * 직원 통계 조회 (대시보드용)
 */
export const getEmployeeStats = unstable_cache(
  async (storeId?: string | null): Promise<{
    total: number
    active: number
    byRole: Record<string, number>
    byDepartment: Record<string, number>
    newThisMonth: number
  }> => {
    const adminClient = createSafeAdminClient()
    
    let query = adminClient
      .from('employees')
      .select(`
        id,
        is_active,
        department,
        created_at,
        profiles:profiles!employees_user_id_fkey!inner (
          role
        )
      `)
    
    if (storeId) {
      query = query.eq('store_id', storeId)
    }
    
    const { data, error } = await query
    
    if (error) throw error
    
    const employees = data || []
    const currentMonth = new Date()
    const monthStart = startOfMonth(currentMonth)
    
    // 통계 계산
    const stats = {
      total: employees.length,
      active: employees.filter(e => e.is_active).length,
      byRole: {} as Record<string, number>,
      byDepartment: {} as Record<string, number>,
      newThisMonth: employees.filter(e => 
        new Date(e.created_at) >= monthStart
      ).length
    }
    
    // 역할별 집계
    employees.forEach(emp => {
      // profiles is a single object, not an array
      const profileRole = (emp.profiles as any)?.role || 'unknown'
      stats.byRole[profileRole] = (stats.byRole[profileRole] || 0) + 1
      
      if (emp.department) {
        stats.byDepartment[emp.department] = (stats.byDepartment[emp.department] || 0) + 1
      }
    })
    
    return stats
  },
  ['employee-stats'],
  {
    revalidate: 600, // 10분 캐싱
    tags: ['employees', 'stats']
  }
)

/**
 * 출근 기록 조회
 */
export const getAttendanceRecords = unstable_cache(
  async (
    employeeId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<AttendanceRecord[]> => {
    const adminClient = createSafeAdminClient()
    
    let query = adminClient
      .from('attendance_records')
      .select('*')
    
    if (employeeId) {
      query = query.eq('employee_id', employeeId)
    }
    
    if (startDate) {
      query = query.gte('date', startDate)
    }
    
    if (endDate) {
      query = query.lte('date', endDate)
    }
    
    query = query.order('date', { ascending: false })
    
    const { data, error } = await query
    
    if (error) throw error
    
    return data || []
  },
  ['attendance'],
  {
    revalidate: 60, // 1분 캐싱 (실시간성 중요)
    tags: ['attendance']
  }
)

/**
 * 급여 계산 내역 조회
 */
export const getSalaryCalculations = unstable_cache(
  async (
    employeeId?: string,
    month?: string,
    storeId?: string
  ): Promise<SalaryCalculation[]> => {
    const adminClient = createSafeAdminClient()
    
    let query = adminClient
      .from('salary_calculations')
      .select(`
        *,
        employees!inner(
          store_id
        )
      `)
    
    if (employeeId) {
      query = query.eq('employee_id', employeeId)
    }
    
    if (month) {
      query = query.eq('month', month)
    }
    
    if (storeId) {
      query = query.eq('employees.store_id', storeId)
    }
    
    query = query.order('month', { ascending: false })
    
    const { data, error } = await query
    
    if (error) throw error
    
    return data || []
  },
  ['salary'],
  {
    revalidate: 300, // 5분 캐싱
    tags: ['salary']
  }
)

/**
 * 부서 목록 조회
 */
export const getDepartments = unstable_cache(
  async (): Promise<string[]> => {
    const adminClient = createSafeAdminClient()
    
    const { data, error } = await adminClient
      .from('employees')
      .select('department')
      .not('department', 'is', null)
      .order('department')
    
    if (error) throw error
    
    // 중복 제거
    const departments = [...new Set(data?.map(d => d.department) || [])]
    
    return departments
  },
  ['departments'],
  {
    revalidate: 3600, // 1시간 캐싱
    tags: ['employees']
  }
)

/**
 * 직원별 월간 근무 요약
 */
export const getMonthlyWorkSummary = unstable_cache(
  async (
    employeeId: string,
    year: number,
    month: number
  ): Promise<{
    totalDays: number
    presentDays: number
    absentDays: number
    lateDays: number
    totalHours: number
    overtimeHours: number
  }> => {
    const adminClient = createSafeAdminClient()
    
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0]
    const endDate = endOfMonth(new Date(year, month - 1, 1)).toISOString().split('T')[0]
    
    const { data, error } = await adminClient
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('date', startDate)
      .lte('date', endDate)
    
    if (error) throw error
    
    const records = data || []
    
    const summary = {
      totalDays: records.length,
      presentDays: records.filter(r => r.status === 'present').length,
      absentDays: records.filter(r => r.status === 'absent').length,
      lateDays: records.filter(r => r.status === 'late').length,
      totalHours: 0,
      overtimeHours: records.reduce((sum, r) => sum + (r.overtime_hours || 0), 0)
    }
    
    // 총 근무시간 계산
    records.forEach(record => {
      if (record.check_in_time && record.check_out_time) {
        const checkIn = new Date(`2000-01-01T${record.check_in_time}`)
        const checkOut = new Date(`2000-01-01T${record.check_out_time}`)
        const hours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)
        summary.totalHours += hours
      }
    })
    
    return summary
  },
  ['work-summary'],
  {
    revalidate: 300, // 5분 캐싱
    tags: ['attendance', 'work-summary']
  }
)