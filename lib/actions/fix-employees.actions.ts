'use server'

import { createAdminClient } from '@/lib/supabase/server-admin'
import { revalidateTag, revalidatePath } from 'next/cache'

export async function fixMissingEmployees() {
  const adminClient = createAdminClient()
  
  try {
    // 1. 승인된 가입 요청 중 employees 레코드가 없는 사용자 찾기
    const { data: approvedRequests, error: requestError } = await adminClient
      .from('employee_signup_requests')
      .select('*')
      .eq('status', 'approved')
    
    if (requestError) {
      console.error('Error fetching approved requests:', requestError)
      return { success: false, error: requestError.message }
    }
    
    let fixedCount = 0
    const results = []
    
    for (const request of approvedRequests || []) {
      // profiles 확인
      const { data: profile, error: profileError } = await adminClient
        .from('profiles')
        .select('*')
        .eq('email', request.email)
        .single()
      
      if (!profile) {
        console.log(`Profile not found for ${request.email}`)
        continue
      }
      
      // employees 레코드 확인
      const { data: employee, error: employeeError } = await adminClient
        .from('employees')
        .select('*')
        .eq('user_id', profile.id)
        .single()
      
      if (!employee) {
        // employees 레코드 생성
        console.log(`Creating employee record for ${profile.full_name} (${profile.email})`)
        
        const { error: createError } = await adminClient
          .from('employees')
          .insert({
            user_id: profile.id,
            store_id: request.store_id || profile.store_id,
            qr_code: `EMP-${profile.id}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            hourly_wage: 10500,
            employment_type: profile.role === 'part_time' ? 'part_time' : 'full_time',
            department: '미지정',
            hire_date: request.approved_at ? new Date(request.approved_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            is_active: true
          })
        
        if (createError) {
          console.error(`Failed to create employee for ${profile.email}:`, createError)
          results.push({
            email: profile.email,
            name: profile.full_name,
            status: 'failed',
            error: createError.message
          })
        } else {
          fixedCount++
          results.push({
            email: profile.email,
            name: profile.full_name,
            status: 'fixed'
          })
        }
      } else {
        results.push({
          email: profile.email,
          name: profile.full_name,
          status: 'already_exists'
        })
      }
    }
    
    // 캐시 무효화
    revalidateTag('employees')
    revalidatePath('/dashboard/employees')
    revalidatePath('/dashboard')
    
    return {
      success: true,
      fixedCount,
      totalChecked: approvedRequests?.length || 0,
      results
    }
  } catch (error: any) {
    console.error('Error in fixMissingEmployees:', error)
    return { success: false, error: error.message }
  }
}

export async function checkEmployeeData(email: string) {
  const adminClient = createAdminClient()
  
  try {
    // Profile 확인
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single()
    
    if (profileError || !profile) {
      return {
        success: false,
        error: 'Profile not found',
        data: null
      }
    }
    
    // Employee 확인
    const { data: employee, error: employeeError } = await adminClient
      .from('employees')
      .select('*')
      .eq('user_id', profile.id)
      .single()
    
    // Signup request 확인
    const { data: signupRequest } = await adminClient
      .from('employee_signup_requests')
      .select('*')
      .eq('email', email)
      .single()
    
    return {
      success: true,
      data: {
        profile,
        employee,
        signupRequest,
        hasProfile: !!profile,
        hasEmployee: !!employee,
        isApproved: signupRequest?.status === 'approved'
      }
    }
  } catch (error: any) {
    console.error('Error checking employee data:', error)
    return { success: false, error: error.message, data: null }
  }
}