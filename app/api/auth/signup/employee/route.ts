import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, fullName, phone, storeCode, storeId, password } = body

    if (!email || !fullName || (!storeCode && !storeId) || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // 비밀번호 길이 검증
    if (password.length < 8) {
      return NextResponse.json(
        { error: '비밀번호는 8자 이상이어야 합니다' },
        { status: 400 }
      )
    }

    // Service client를 사용하여 RLS 우회
    const supabase = createServiceClient()

    let finalStoreId = storeId

    // storeId가 없는 경우에만 storeCode로 찾기
    if (!storeId && storeCode) {
      // Find store by code
      const { data: store, error: storeError } = await supabase
        .from('stores')
        .select('id')
        .eq('code', storeCode)
        .single()

      if (storeError || !store) {
        console.error('Store lookup error:', storeError)
        return NextResponse.json(
          { error: 'Invalid store code' },
          { status: 400 }
        )
      }
      
      finalStoreId = store.id
    }

    // 디버깅용 로그
    console.log('Creating signup request:', {
      email,
      fullName,
      phone,
      storeId: finalStoreId,
      storeCode
    })

    // Create signup request with password
    const { data: signupRequest, error: signupError } = await supabase
      .from('employee_signup_requests')
      .insert({
        email,
        full_name: fullName,
        phone,
        store_id: finalStoreId,
        store_code: storeCode || null,
        verification_code: Math.floor(100000 + Math.random() * 900000).toString(),
        password_hash: password, // 임시로 평문 저장 (실제로는 해시해야 함)
      })
      .select()
      .single()

    if (signupError) {
      console.error('Signup request error:', signupError)
      
      if (signupError.code === '23505') { // Unique violation
        return NextResponse.json(
          { error: 'Email already registered' },
          { status: 400 }
        )
      }
      
      // 더 자세한 에러 메시지 (개발 중에만)
      return NextResponse.json(
        { 
          error: 'Failed to create signup request',
          details: signupError.message 
        },
        { status: 400 }
      )
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
    
    // 더 자세한 에러 정보 제공
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: errorMessage // 개발 중에만
      },
      { status: 500 }
    )
  }
}