'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Employee } from '@/lib/data/employees.data'
import { notify } from '@/components/ui/notification-toast'

interface UseRealtimeEmployeesProps {
  initialEmployees: Employee[]
  storeId?: string | null
  organizationId?: string | null
}

export function useRealtimeEmployees({
  initialEmployees,
  storeId,
  organizationId
}: UseRealtimeEmployeesProps) {
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees)
  const [pendingApprovals, setPendingApprovals] = useState(0)
  const [isConnected, setIsConnected] = useState(false)
  const supabase = createClient()

  // Fetch latest employee data
  const fetchEmployees = useCallback(async () => {
    try {
      let query = supabase
        .from('employees')
        .select(`
          *,
          profiles!inner(
            id,
            email,
            full_name,
            phone,
            role,
            is_approved
          ),
          stores (
            id,
            name,
            code
          )
        `)

      if (storeId) {
        query = query.eq('store_id', storeId)
      } else if (organizationId) {
        query = query.eq('organization_id', organizationId)
      }

      const { data, error } = await query.order('created_at', { ascending: false })
      
      if (error) throw error
      
      if (data) {
        setEmployees(data as Employee[])
      }
    } catch (error) {
      console.error('Error fetching employees:', error)
    }
  }, [storeId, organizationId, supabase])

  // Fetch pending approvals count
  const fetchPendingApprovals = useCallback(async () => {
    try {
      const { count } = await supabase
        .from('employee_signup_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'verified')
      
      setPendingApprovals(count || 0)
    } catch (error) {
      console.error('Error fetching pending approvals:', error)
    }
  }, [supabase])

  useEffect(() => {
    // Initial fetch
    fetchPendingApprovals()

    // Set up real-time subscriptions
    const employeesChannel = supabase
      .channel('employees-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'employees',
          filter: storeId ? `store_id=eq.${storeId}` : undefined
        },
        (payload) => {
          console.log('Employee change detected:', payload)
          
          if (payload.eventType === 'INSERT') {
            notify({
              type: 'info',
              title: '새 직원 추가',
              message: '새로운 직원이 등록되었습니다.',
              duration: 3000
            })
            fetchEmployees()
          } else if (payload.eventType === 'UPDATE') {
            const updatedEmployee = payload.new as Employee
            setEmployees(prev => 
              prev.map(emp => 
                emp.id === updatedEmployee.id ? updatedEmployee : emp
              )
            )
            
            // Check if activation status changed
            if (payload.old && 'is_active' in payload.old) {
              const wasActive = (payload.old as any).is_active
              const isActive = updatedEmployee.is_active
              
              if (!wasActive && isActive) {
                notify({
                  type: 'success',
                  title: '직원 활성화',
                  message: '직원이 활성화되었습니다.',
                  duration: 3000
                })
              } else if (wasActive && !isActive) {
                notify({
                  type: 'warning',
                  title: '직원 비활성화',
                  message: '직원이 비활성화되었습니다.',
                  duration: 3000
                })
              }
            }
          } else if (payload.eventType === 'DELETE') {
            setEmployees(prev => 
              prev.filter(emp => emp.id !== payload.old.id)
            )
            notify({
              type: 'info',
              title: '직원 삭제',
              message: '직원 정보가 삭제되었습니다.',
              duration: 3000
            })
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          // Update employee profiles when changed
          if (payload.eventType === 'UPDATE') {
            fetchEmployees()
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED')
        if (status === 'SUBSCRIBED') {
          console.log('Real-time subscription active')
        }
      })

    // Subscription for signup requests
    const requestsChannel = supabase
      .channel('signup-requests')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'employee_signup_requests'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newRequest = payload.new as any
            if (newRequest.status === 'verified') {
              setPendingApprovals(prev => prev + 1)
              notify({
                type: 'info',
                title: '새 가입 요청',
                message: `${newRequest.full_name}님의 가입 요청이 있습니다.`,
                duration: 5000,
                action: {
                  label: '확인하기',
                  onClick: () => {
                    window.location.href = '/dashboard/employee-requests'
                  }
                }
              })
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedRequest = payload.new as any
            if (updatedRequest.status !== 'verified' && (payload.old as any).status === 'verified') {
              setPendingApprovals(prev => Math.max(0, prev - 1))
            }
          }
          fetchPendingApprovals()
        }
      )
      .subscribe()

    // Cleanup
    return () => {
      employeesChannel.unsubscribe()
      requestsChannel.unsubscribe()
    }
  }, [storeId, organizationId, fetchEmployees, fetchPendingApprovals, supabase])

  return {
    employees,
    pendingApprovals,
    isConnected,
    refetch: fetchEmployees
  }
}