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
    
    // Check if service role key is available
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not set in environment variables')
      return NextResponse.json(
        { 
          error: '서버 설정 오류', 
          details: 'Service role key가 설정되지 않았습니다. Vercel 환경 변수를 확인해주세요.',
          helpUrl: 'https://vercel.com/docs/environment-variables'
        },
        { status: 500 }
      )
    }
    
    const adminClient = createAdminClient()
    console.log('Admin client created successfully')

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

      console.log('Creating user with payload:', JSON.stringify({
        ...createUserPayload,
        password: '***hidden***'
      }))
      
      const { data: newUser, error: authError } = await adminClient.auth.admin.createUser(createUserPayload)
      
      if (authError) {
        console.error('Auth creation error:', authError)
        console.error('Error code:', authError.code)
        console.error('Error status:', authError.status)
        console.error('Full error object:', JSON.stringify(authError, null, 2))
        
        // 더 구체적인 에러 메시지 제공
        let errorMessage = '사용자 생성 실패'
        if (authError.message.includes('service_role')) {
          errorMessage = 'Service role 키 권한 오류'
        } else if (authError.message.includes('already registered')) {
          errorMessage = '이미 등록된 이메일입니다'
        } else if (authError.message.includes('not authorized')) {
          errorMessage = 'Service role 키가 유효하지 않습니다. Vercel 환경변수를 다시 확인해주세요.'
        } else if (authError.status === 401) {
          errorMessage = 'Service role 키 인증 실패. 올바른 키인지 확인해주세요.'
        }
        
        return NextResponse.json(
          { 
            error: errorMessage, 
            details: authError.message,
            code: authError.code || 'unknown',
            status: authError.status
          },
          { status: 500 }
        )
      }
      
      authData = newUser
    }

    // Employee record will be created automatically by trigger
    const userId = (authData as any)?.user?.id || (authData as any)?.id || null
    console.log('User created/updated with ID:', userId)

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