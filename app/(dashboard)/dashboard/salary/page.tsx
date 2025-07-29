'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import type { Database } from '@/types/supabase'

interface Employee {
  id: string
  employee_number: string
  hourly_wage: number | null
  profiles: {
    full_name: string
    email: string
  }
  stores: {
    name: string
  }
}

interface SalaryCalculation {
  id: string
  employee_id: string
  calculation_month: string
  hourly_wage: number
  total_work_hours: number
  total_amount: number
  employee_name?: string
  employee_number?: string
  store_name?: string
}

export default function SalaryPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [calculations, setCalculations] = useState<SalaryCalculation[]>([])
  const [hourlyWages, setHourlyWages] = useState<{ [key: string]: string }>({})
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string>('')
  const [editingWage, setEditingWage] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClientComponentClient<Database>()

  useEffect(() => {
    checkUserRole()
  }, [])

  useEffect(() => {
    if (userRole) {
      fetchEmployees()
      fetchCalculations()
    }
  }, [selectedMonth, userRole])

  const checkUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['super_admin', 'admin', 'manager'].includes(profile.role)) {
      router.push('/dashboard')
      return
    }

    setUserRole(profile.role)
  }

  const fetchEmployees = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let query = supabase
      .from('employees')
      .select(`
        id,
        employee_number,
        hourly_wage,
        profiles!inner(full_name, email),
        stores!inner(name)
      `)
      .eq('is_active', true)

    // 매니저는 자기 매장 직원만
    if (userRole === 'manager') {
      const { data: managerEmployee } = await supabase
        .from('employees')
        .select('store_id')
        .eq('user_id', user.id)
        .single()

      if (managerEmployee?.store_id) {
        query = query.eq('store_id', managerEmployee.store_id)
      }
    }

    const { data, error } = await query.order('employee_number')

    if (!error && data) {
      const formattedData = data.map((item: any) => ({
        id: item.id,
        employee_number: item.employee_number,
        hourly_wage: item.hourly_wage,
        profiles: {
          full_name: item.profiles.full_name,
          email: item.profiles.email
        },
        stores: {
          name: item.stores.name
        }
      }))
      setEmployees(formattedData)
      // 시급 데이터 초기화
      const wages: { [key: string]: string } = {}
      formattedData.forEach(emp => {
        wages[emp.id] = emp.hourly_wage?.toString() || ''
      })
      setHourlyWages(wages)
    }
  }

  const fetchCalculations = async () => {
    setLoading(true)
    
    const { data, error } = await supabase
      .from('salary_view')
      .select('*')
      .eq('calculation_month', `${selectedMonth}-01`)

    if (!error && data) {
      setCalculations(data)
    }
    setLoading(false)
  }

  const updateHourlyWage = async (employeeId: string, wage: string) => {
    const numericWage = parseFloat(wage)
    if (isNaN(numericWage) || numericWage < 0) {
      alert('올바른 시급을 입력해주세요.')
      return
    }

    const { error } = await supabase
      .from('employees')
      .update({ hourly_wage: numericWage })
      .eq('id', employeeId)

    if (error) {
      alert('시급 저장 중 오류가 발생했습니다: ' + error.message)
    } else {
      setEditingWage(null)
      // 시급 변경 후 해당 직원 급여 재계산
      const calculation = calculations.find(c => c.employee_id === employeeId)
      if (calculation) {
        calculateSalary(employeeId)
      }
    }
  }

  const calculateSalary = async (employeeId: string) => {
    const [year, month] = selectedMonth.split('-')
    
    const { data, error } = await supabase.rpc('calculate_simple_salary', {
      p_employee_id: employeeId,
      p_year: parseInt(year),
      p_month: parseInt(month)
    })

    if (error) {
      alert('급여 계산 중 오류가 발생했습니다: ' + error.message)
      return
    }

    if (data && data.length > 0) {
      const result = data[0]
      
      if (result.hourly_wage === 0) {
        alert('시급이 설정되지 않았습니다. 먼저 시급을 입력해주세요.')
        return
      }

      // 계산 결과 저장
      const { error: saveError } = await supabase
        .from('salary_calculations_simple')
        .upsert({
          employee_id: employeeId,
          calculation_month: `${selectedMonth}-01`,
          hourly_wage: result.hourly_wage,
          total_work_hours: result.total_work_hours,
          total_amount: result.total_amount,
          calculated_by: (await supabase.auth.getUser()).data.user?.id
        })

      if (saveError) {
        alert('계산 결과 저장 중 오류가 발생했습니다: ' + saveError.message)
      } else {
        fetchCalculations()
      }
    }
  }

  const calculateAllSalaries = async () => {
    if (!confirm('모든 직원의 급여를 계산하시겠습니까?')) return

    for (const employee of employees) {
      if (employee.hourly_wage && employee.hourly_wage > 0) {
        await calculateSalary(employee.id)
      }
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(amount)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">급여 관리</h1>
        <p className="text-gray-600">직원별 시급을 설정하고 급여를 계산합니다. (시간 × 시급)</p>
      </div>

      <div className="mb-6 flex items-center gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            계산 월
          </label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div className="flex items-end">
          <button
            onClick={calculateAllSalaries}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            전체 급여 계산
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">급여 정보를 불러오는 중...</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    사번
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    이름
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    매장
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    시급
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    근무시간
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    급여액
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {employees.map((employee) => {
                  const calculation = calculations.find(c => c.employee_id === employee.id)
                  
                  return (
                    <tr key={employee.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {employee.employee_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {employee.profiles.full_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {employee.stores.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {editingWage === employee.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={hourlyWages[employee.id] || ''}
                              onChange={(e) => setHourlyWages({
                                ...hourlyWages,
                                [employee.id]: e.target.value
                              })}
                              className="w-24 px-2 py-1 border border-gray-300 rounded"
                              placeholder="시급"
                            />
                            <button
                              onClick={() => updateHourlyWage(employee.id, hourlyWages[employee.id])}
                              className="text-green-600 hover:text-green-900"
                            >
                              저장
                            </button>
                            <button
                              onClick={() => {
                                setEditingWage(null)
                                setHourlyWages({
                                  ...hourlyWages,
                                  [employee.id]: employee.hourly_wage?.toString() || ''
                                })
                              }}
                              className="text-gray-600 hover:text-gray-900"
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span>
                              {employee.hourly_wage ? formatCurrency(employee.hourly_wage) : '-'}
                            </span>
                            <button
                              onClick={() => setEditingWage(employee.id)}
                              className="text-blue-600 hover:text-blue-900 text-sm"
                            >
                              수정
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {calculation ? `${calculation.total_work_hours}시간` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {calculation ? formatCurrency(calculation.total_amount) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => calculateSalary(employee.id)}
                          className="text-blue-600 hover:text-blue-900"
                          disabled={!employee.hourly_wage || employee.hourly_wage <= 0}
                        >
                          {calculation ? '재계산' : '계산'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}