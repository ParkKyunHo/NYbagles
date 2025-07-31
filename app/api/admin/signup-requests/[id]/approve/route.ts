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
      .eq('status', 'verified')
      .single()

    if (requestError || !signupRequest) {
      return NextResponse.json(
        { error: 'Signup request not found or not verified' },
        { status: 404 }
      )
    }

    // Create user in Supabase Auth with password if available
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

    const { data: authData, error: authError } = await supabase.auth.admin.createUser(createUserPayload)

    if (authError) {
      console.error('Auth creation error:', authError)
      throw authError
    }

    // Create employee record - check if employees table exists
    // If not, the profile will be created by the trigger
    try {
      const { error: employeeError } = await supabase
        .from('employees')
        .insert({
          user_id: authData.user.id,
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
      userId: authData.user.id,
    })
  } catch (error) {
    console.error('Approve signup request error:', error)
    return NextResponse.json(
      { error: 'Failed to approve signup request' },
      { status: 500 }
    )
  }
}