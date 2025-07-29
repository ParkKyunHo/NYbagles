import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, fullName, phone, storeCode } = body

    if (!email || !fullName || !storeCode) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Find store by code
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id')
      .eq('code', storeCode)
      .single()

    if (storeError || !store) {
      return NextResponse.json(
        { error: 'Invalid store code' },
        { status: 400 }
      )
    }

    // Create signup request
    const { data: signupRequest, error: signupError } = await supabase
      .from('employee_signup_requests')
      .insert({
        email,
        full_name: fullName,
        phone,
        store_id: store.id,
        store_code: storeCode,
        verification_code: Math.floor(100000 + Math.random() * 900000).toString(),
      })
      .select()
      .single()

    if (signupError) {
      if (signupError.code === '23505') { // Unique violation
        return NextResponse.json(
          { error: 'Email already registered' },
          { status: 400 }
        )
      }
      throw signupError
    }

    // In production, send verification email
    // For now, return the verification code (development only)
    return NextResponse.json({
      message: 'Signup request created successfully',
      requestId: signupRequest.id,
      // Remove this in production
      verificationCode: signupRequest.verification_code,
    })
  } catch (error) {
    console.error('Employee signup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}