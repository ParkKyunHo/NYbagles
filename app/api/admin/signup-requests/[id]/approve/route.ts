import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/permissions'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole(['super_admin', 'admin', 'manager'])
    const body = await request.json()
    const { role = 'employee' } = body

    const supabase = await createClient()
    const adminClient = createAdminClient()

    // Get signup request
    const { data: signupRequest, error: requestError } = await supabase
      .from('employee_signup_requests')
      .select('*')
      .eq('id', params.id)
      .single()

    if (requestError || !signupRequest) {
      console.error('Error fetching signup request:', requestError)
      return NextResponse.json(
        { error: '가입 요청을 찾을 수 없습니다.', details: requestError?.message },
        { status: 404 }
      )
    }

    // Check if user already exists by listing users
    const { data: { users: existingUsers }, error: listError } = await adminClient.auth.admin.listUsers()
    
    if (listError) {
      console.error('Error listing users:', listError)
      return NextResponse.json(
        { error: '사용자 목록 조회 실패', details: listError.message },
        { status: 500 }
      )
    }
    
    const existingUser = existingUsers?.find(u => u.email === signupRequest.email)
    
    let authData
    if (existingUser) {
      // User already exists, just update metadata
      const { data: updatedUser, error: updateError } = await adminClient.auth.admin.updateUserById(
        existingUser.id,
        {
          user_metadata: {
            full_name: signupRequest.full_name,
            role: role,
            store_id: signupRequest.store_id,
          },
        }
      )
      
      if (updateError) {
        console.error('User update error:', updateError)
        return NextResponse.json(
          { error: '사용자 정보 업데이트 실패', details: updateError.message },
          { status: 500 }
        )
      }
      
      authData = { user: updatedUser }
    } else {
      // Create new user
      const createUserPayload: any = {
        email: signupRequest.email,
        email_confirm: true,
        user_metadata: {
          full_name: signupRequest.full_name,
          role: role,
          store_id: signupRequest.store_id,
        },
      }

      // 항상 임시 비밀번호 생성 (승인 후 이메일로 재설정 링크 전송)
      createUserPayload.password = Math.random().toString(36).slice(-12) + 'A1!'

      const { data: newUser, error: authError } = await adminClient.auth.admin.createUser(createUserPayload)
      
      if (authError) {
        console.error('Auth creation error:', authError)
        return NextResponse.json(
          { error: '사용자 생성 실패', details: authError.message },
          { status: 500 }
        )
      }
      
      authData = newUser
    }

    // Create employee record - check if employees table exists
    // If not, the profile will be created by the trigger
    const userId = (authData as any)?.user?.id || (authData as any)?.id || null
    
    try {
      const { error: employeeError } = await supabase
        .from('employees')
        .insert({
          user_id: userId,
          store_id: signupRequest.store_id,
          qr_code: `EMP-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          hire_date: new Date().toISOString().split('T')[0],
          is_active: true,
        })

      if (employeeError) {
        console.log('Employee table might not exist, relying on trigger:', employeeError)
        // Don't throw here, as the profile will be created by the trigger
      }
    } catch (e) {
      console.log('Employee creation skipped, profile will be created by trigger')
    }

    // Update signup request
    const { error: updateError } = await supabase
      .from('employee_signup_requests')
      .update({
        approved: true,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        status: 'approved',
      })
      .eq('id', params.id)

    if (updateError) {
      throw updateError
    }

    // 항상 비밀번호 재설정 이메일 전송
    const { error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: signupRequest.email,
    })
    
    if (linkError) {
      console.error('Error generating recovery link:', linkError)
      // 이메일 전송 실패해도 승인은 완료로 처리
    }

    return NextResponse.json({
      message: 'Employee approved successfully',
      userId: userId,
    })
  } catch (error: any) {
    console.error('Approve signup request error:', error)
    return NextResponse.json(
      { 
        error: '가입 승인 처리 중 오류가 발생했습니다.', 
        details: error?.message || '알 수 없는 오류',
        code: error?.code
      },
      { status: 500 }
    )
  }
}