import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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

    // Get signup request
    const { data: signupRequest, error: requestError } = await supabase
      .from('employee_signup_requests')
      .select('*')
      .eq('id', params.id)
      .single()

    if (requestError || !signupRequest) {
      return NextResponse.json(
        { error: 'Signup request not found or not verified' },
        { status: 404 }
      )
    }

    // Check if user already exists by listing users
    const { data: { users: existingUsers }, error: listError } = await supabase.auth.admin.listUsers()
    const existingUser = existingUsers?.find(u => u.email === signupRequest.email)
    
    let authData
    if (existingUser) {
      // User already exists, just update metadata
      const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
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
        throw updateError
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

      // 비밀번호가 있으면 사용, 없으면 임시 비밀번호 생성
      if (signupRequest.password_hash) {
        createUserPayload.password = signupRequest.password_hash
      } else {
        // 비밀번호가 없는 경우 임시 비밀번호 생성
        createUserPayload.password = Math.random().toString(36).slice(-12) + 'A1!'
      }

      const { data: newUser, error: authError } = await supabase.auth.admin.createUser(createUserPayload)
      
      if (authError) {
        console.error('Auth creation error:', authError)
        throw authError
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

    // Send password reset email only if password was not provided
    if (!signupRequest.password_hash) {
      await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: signupRequest.email,
      })
    }

    return NextResponse.json({
      message: 'Employee approved successfully',
      userId: userId,
    })
  } catch (error) {
    console.error('Approve signup request error:', error)
    return NextResponse.json(
      { error: 'Failed to approve signup request' },
      { status: 500 }
    )
  }
}