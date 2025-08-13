'use server'

import { createAdminClient } from '@/lib/supabase/server-admin'
import { revalidatePath, revalidateTag } from 'next/cache'
import { getAuthUser } from '@/lib/auth/unified-auth'

interface SignupRequestInput {
  email: string
  fullName: string
  phone?: string
  storeCode?: string
}

/**
 * 직원 가입 신청 생성
 */
export async function createSignupRequest(input: SignupRequestInput) {
  const adminClient = createAdminClient()
  
  try {
    // 이메일 중복 체크
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id')
      .eq('email', input.email)
      .single()
    
    if (existingProfile) {
      return {
        success: false,
        error: '이미 등록된 이메일입니다'
      }
    }
    
    // 매장 코드로 매장 ID 조회
    let storeId = null
    if (input.storeCode) {
      const { data: store } = await adminClient
        .from('stores')
        .select('id')
        .eq('code', input.storeCode)
        .single()
      
      if (!store) {
        return {
          success: false,
          error: '유효하지 않은 매장 코드입니다'
        }
      }
      storeId = store.id
    }
    
    // 가입 신청 생성
    const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase()
    
    const { data: request, error } = await adminClient
      .from('employee_signup_requests')
      .insert({
        email: input.email,
        full_name: input.fullName,
        phone: input.phone,
        store_code: input.storeCode,
        store_id: storeId,
        verification_code: verificationCode,
        status: 'pending',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single()
    
    if (error) throw error
    
    // 캐시 무효화
    revalidateTag('signup-requests')
    
    return {
      success: true,
      request,
      verificationCode,
      message: '가입 신청이 접수되었습니다. 관리자 승인을 기다려주세요.'
    }
  } catch (error) {
    console.error('Signup request error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '가입 신청 중 오류가 발생했습니다'
    }
  }
}

/**
 * 가입 신청 승인
 */
export async function approveSignupRequest(requestId: string, role: string = 'employee') {
  const user = await getAuthUser()
  const adminClient = createAdminClient()
  
  // 권한 체크
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return {
      success: false,
      error: '승인 권한이 없습니다'
    }
  }
  
  try {
    // 가입 신청 조회
    const { data: request } = await adminClient
      .from('employee_signup_requests')
      .select('*')
      .eq('id', requestId)
      .eq('status', 'pending')
      .single()
    
    if (!request) {
      return {
        success: false,
        error: '유효하지 않은 가입 신청입니다'
      }
    }
    
    // 1. Auth 사용자 생성
    const tempPassword = Math.random().toString(36).slice(-12)
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: request.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: request.full_name,
        role: role
      }
    })
    
    if (authError) throw authError
    
    // 2. Profile 생성
    const { error: profileError } = await adminClient
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: request.email,
        full_name: request.full_name,
        role: role,
        phone: request.phone,
        created_at: new Date().toISOString()
      })
    
    if (profileError) {
      // 롤백: Auth 사용자 삭제
      await adminClient.auth.admin.deleteUser(authData.user.id)
      throw profileError
    }
    
    // 3. Employee 레코드 생성
    const { error: employeeError } = await adminClient
      .from('employees')
      .insert({
        user_id: authData.user.id,
        store_id: request.store_id,
        qr_code: `EMP-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        employment_type: 'full_time',
        hire_date: new Date().toISOString().split('T')[0],
        is_active: true
      })
    
    if (employeeError) {
      // 롤백: Auth 사용자 삭제
      await adminClient.auth.admin.deleteUser(authData.user.id)
      throw employeeError
    }
    
    // 4. 가입 신청 상태 업데이트
    const { error: updateError } = await adminClient
      .from('employee_signup_requests')
      .update({
        status: 'approved',
        approved: true,
        approved_by: user.id,
        approved_at: new Date().toISOString()
      })
      .eq('id', requestId)
    
    if (updateError) throw updateError
    
    // 5. 비밀번호 재설정 이메일 발송
    await adminClient.auth.resetPasswordForEmail(request.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/login`
    })
    
    // 캐시 무효화
    revalidateTag('signup-requests')
    revalidateTag('employees')
    revalidatePath('/dashboard/employees')
    
    return {
      success: true,
      message: '가입 신청이 승인되었습니다. 사용자에게 비밀번호 설정 이메일이 발송되었습니다.'
    }
  } catch (error) {
    console.error('Approval error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '승인 처리 중 오류가 발생했습니다'
    }
  }
}

/**
 * 가입 신청 거절
 */
export async function rejectSignupRequest(requestId: string, reason: string) {
  const user = await getAuthUser()
  const adminClient = createAdminClient()
  
  // 권한 체크
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return {
      success: false,
      error: '거절 권한이 없습니다'
    }
  }
  
  try {
    const { error } = await adminClient
      .from('employee_signup_requests')
      .update({
        status: 'rejected',
        approved: false,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        rejection_reason: reason
      })
      .eq('id', requestId)
      .eq('status', 'pending')
    
    if (error) throw error
    
    // 캐시 무효화
    revalidateTag('signup-requests')
    
    return {
      success: true,
      message: '가입 신청이 거절되었습니다'
    }
  } catch (error) {
    console.error('Rejection error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '거절 처리 중 오류가 발생했습니다'
    }
  }
}

/**
 * 대기중인 가입 신청 목록 조회
 */
export async function getPendingSignupRequests() {
  const user = await getAuthUser()
  const adminClient = createAdminClient()
  
  // 권한 체크
  if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
    return {
      success: false,
      error: '조회 권한이 없습니다',
      requests: []
    }
  }
  
  try {
    const query = adminClient
      .from('employee_signup_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    
    // 매니저는 자신의 매장 신청만 조회
    if (user.role === 'manager') {
      const { data: employee } = await adminClient
        .from('employees')
        .select('store_id')
        .eq('user_id', user.id)
        .single()
      
      if (employee?.store_id) {
        query.eq('store_id', employee.store_id)
      }
    }
    
    const { data: requests, error } = await query
    
    if (error) throw error
    
    return {
      success: true,
      requests: requests || []
    }
  } catch (error) {
    console.error('Get pending requests error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '조회 중 오류가 발생했습니다',
      requests: []
    }
  }
}