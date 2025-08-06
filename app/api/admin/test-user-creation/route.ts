import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/permissions'

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(['super_admin', 'admin'])
    const { email, full_name, store_id } = await request.json()
    
    if (!email || !full_name || !store_id) {
      return NextResponse.json(
        { error: '이메일, 이름, 매장 ID는 필수입니다.' },
        { status: 400 }
      )
    }
    
    const adminClient = createAdminClient()
    const supabase = await createClient()
    
    // Step 1: Check if user already exists
    console.log('Step 1: Checking existing users...')
    const { data: { users: existingUsers }, error: listError } = await adminClient.auth.admin.listUsers()
    
    if (listError) {
      return NextResponse.json({
        step: 1,
        error: '사용자 목록 조회 실패',
        details: listError
      }, { status: 500 })
    }
    
    const existingUser = existingUsers?.find(u => u.email === email)
    if (existingUser) {
      return NextResponse.json({
        step: 1,
        error: '이미 존재하는 사용자',
        userId: existingUser.id,
        email: existingUser.email,
        createdAt: existingUser.created_at
      }, { status: 400 })
    }
    
    // Step 2: Check store validity
    console.log('Step 2: Checking store validity...')
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, name')
      .eq('id', store_id)
      .single()
    
    if (storeError || !store) {
      return NextResponse.json({
        step: 2,
        error: '유효하지 않은 매장 ID',
        storeId: store_id,
        details: storeError
      }, { status: 400 })
    }
    
    // Step 3: Check if email exists in profiles
    console.log('Step 3: Checking existing profiles...')
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', email)
      .single()
    
    if (existingProfile) {
      return NextResponse.json({
        step: 3,
        error: '프로필이 이미 존재함',
        profileId: existingProfile.id,
        email: existingProfile.email
      }, { status: 400 })
    }
    
    // Step 4: Create user
    console.log('Step 4: Creating user...')
    const createUserPayload = {
      email: email,
      email_confirm: true,
      password: Math.random().toString(36).slice(-12) + 'A1!',
      user_metadata: {
        full_name: full_name,
        role: 'employee',
        store_id: store_id,
      }
    }
    
    const { data: newUser, error: authError } = await adminClient.auth.admin.createUser(createUserPayload)
    
    if (authError) {
      return NextResponse.json({
        step: 4,
        error: '사용자 생성 실패',
        details: authError,
        payload: { ...createUserPayload, password: '***hidden***' }
      }, { status: 500 })
    }
    
    const userId = newUser?.user?.id
    
    // Step 5: Check if profile was created by trigger
    console.log('Step 5: Checking trigger execution...')
    await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second for trigger
    
    const { data: newProfile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    
    // Step 6: Check if employee was created
    const { data: newEmployee, error: employeeCheckError } = await supabase
      .from('employees')
      .select('*')
      .eq('user_id', userId)
      .single()
    
    return NextResponse.json({
      success: true,
      userId: userId,
      userCreated: true,
      profileCreated: !!newProfile,
      profileError: profileCheckError?.message,
      employeeCreated: !!newEmployee,
      employeeError: employeeCheckError?.message,
      profile: newProfile,
      employee: newEmployee
    })
    
  } catch (error: any) {
    console.error('Test user creation error:', error)
    return NextResponse.json(
      { 
        error: '테스트 중 오류 발생',
        details: error?.message || '알 수 없는 오류'
      },
      { status: 500 }
    )
  }
}