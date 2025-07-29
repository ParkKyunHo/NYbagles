import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { requestId, verificationCode } = body

    if (!requestId || !verificationCode) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get signup request
    const { data: signupRequest, error: requestError } = await supabase
      .from('employee_signup_requests')
      .select('*')
      .eq('id', requestId)
      .eq('verification_code', verificationCode)
      .eq('status', 'pending')
      .single()

    if (requestError || !signupRequest) {
      return NextResponse.json(
        { error: 'Invalid or expired verification code' },
        { status: 400 }
      )
    }

    // Update request status
    const { error: updateError } = await supabase
      .from('employee_signup_requests')
      .update({
        verified: true,
        verified_at: new Date().toISOString(),
        status: 'verified',
      })
      .eq('id', requestId)

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({
      message: 'Email verified successfully',
      requestId: signupRequest.id,
    })
  } catch (error) {
    console.error('Verification error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}