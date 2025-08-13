import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server-admin'
import { requireRole } from '@/lib/auth/unified-auth'
import { decrypt } from '@/lib/crypto'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole(['super_admin', 'admin', 'manager'])
    const body = await request.json()
    const { role = 'employee' } = body

    const supabase = await createClient()
    
    // Create admin client (환경변수 체크는 createAdminClient 내부에서 처리)
    let adminClient
    try {
      adminClient = createAdminClient()
    } catch (error) {
      console.error('Failed to create admin client:', error)
      return NextResponse.json(
        { 
          error: '서버 설정 오류', 
          details: 'Service role key가 설정되지 않았습니다. Vercel 환경 변수를 확인해주세요.',
          helpUrl: 'https://vercel.com/docs/environment-variables'
        },
        { status: 500 }
      )
    }
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
      console.log('User already exists with email:', signupRequest.email)
      console.log('Existing user ID:', existingUser.id)
      
      // Check if user is already approved
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', existingUser.id)
        .single()
        
      if (existingProfile) {
        return NextResponse.json(
          { 
            error: '이미 승인된 사용자입니다', 
            details: '해당 이메일로 이미 가입된 사용자가 있습니다.',
            userId: existingUser.id
          },
          { status: 400 }
        )
      }
      
      // User exists in auth but not in profiles, update metadata
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

      // 회원가입 시 입력한 비밀번호 사용
      if (signupRequest.password_hash) {
        try {
          // 암호화된 비밀번호를 복호화
          createUserPayload.password = decrypt(signupRequest.password_hash)
        } catch (decryptError) {
          console.error('Password decryption error:', decryptError)
          // 복호화 실패 시 임시 비밀번호 생성
          createUserPayload.password = Math.random().toString(36).slice(-12) + 'A1!'
        }
      } else {
        // 구버전 호환성을 위한 임시 비밀번호
        createUserPayload.password = Math.random().toString(36).slice(-12) + 'A1!'
      }

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
        
        // Check if it's a database constraint error
        if (authError.message && authError.message.includes('Database error')) {
          console.log('Database error detected, attempting to diagnose...')
          
          // Check if email already exists in profiles
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id, email')
            .eq('email', signupRequest.email)
            .single()
          
          if (existingProfile) {
            return NextResponse.json(
              { 
                error: '이미 등록된 이메일입니다', 
                details: '해당 이메일로 이미 프로필이 생성되어 있습니다.',
                email: signupRequest.email,
                profileId: existingProfile.id
              },
              { status: 400 }
            )
          }
          
          // Check store_id validity
          const { data: store } = await supabase
            .from('stores')
            .select('id')
            .eq('id', signupRequest.store_id)
            .single()
          
          if (!store) {
            return NextResponse.json(
              { 
                error: '유효하지 않은 매장 ID', 
                details: '가입 요청의 매장 ID가 존재하지 않습니다.',
                storeId: signupRequest.store_id
              },
              { status: 400 }
            )
          }
        }
        
        // 더 구체적인 에러 메시지 제공
        let errorMessage = '사용자 생성 실패'
        if (authError.message.includes('service_role')) {
          errorMessage = 'Service role 키 권한 오류'
        } else if (authError.message.includes('already registered') || authError.message.includes('duplicate key')) {
          errorMessage = '이미 등록된 이메일입니다'
        } else if (authError.message.includes('not authorized')) {
          errorMessage = 'Service role 키가 유효하지 않습니다. Vercel 환경변수를 다시 확인해주세요.'
        } else if (authError.status === 401) {
          errorMessage = 'Service role 키 인증 실패. 올바른 키인지 확인해주세요.'
        } else if (authError.message.includes('Database error')) {
          errorMessage = '데이터베이스 오류가 발생했습니다'
        }
        
        return NextResponse.json(
          { 
            error: errorMessage, 
            details: authError.message,
            code: authError.code || 'unknown',
            status: authError.status,
            email: signupRequest.email
          },
          { status: 500 }
        )
      }
      
      authData = newUser
    }

    // Employee record will be created automatically by trigger
    const userId = (authData as any)?.user?.id || (authData as any)?.id || null
    console.log('User created/updated with ID:', userId)
    
    // Verify profile was created by trigger
    if (userId) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
        
      if (profileError || !profile) {
        console.error('Profile not created by trigger, creating manually')
        // Create profile manually if trigger failed
        const { error: createProfileError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            full_name: signupRequest.full_name,
            email: signupRequest.email,
            role: role,
            store_id: signupRequest.store_id
          })
          
        if (createProfileError) {
          console.error('Failed to create profile manually:', createProfileError)
        }
      }
      
      // Verify or create employee record
      const { data: employee, error: employeeError } = await supabase
        .from('employees')
        .select('*')
        .eq('user_id', userId)
        .single()
        
      if (employeeError || !employee) {
        console.error('Employee not created by trigger, creating manually')
        // Create employee record manually if trigger failed
        const { error: createEmployeeError } = await supabase
          .from('employees')
          .insert({
            user_id: userId,
            store_id: signupRequest.store_id,
            hourly_wage: 10500, // 최저시급
            is_active: true
          })
          
        if (createEmployeeError) {
          console.error('Failed to create employee manually:', createEmployeeError)
        }
      }
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

    // 비밀번호 재설정 이메일 전송 제거 (사용자가 입력한 비밀번호 사용)

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