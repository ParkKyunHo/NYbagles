import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/permissions'
import { hashToken } from '@/lib/utils/crypto'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const { qrData, location } = body

    if (!qrData) {
      return NextResponse.json(
        { error: 'QR data is required' },
        { status: 400 }
      )
    }

    // Parse QR data
    let parsedData
    try {
      parsedData = JSON.parse(qrData)
    } catch {
      return NextResponse.json(
        { error: 'Invalid QR code' },
        { status: 400 }
      )
    }

    const { storeId, token } = parsedData

    if (!storeId || !token) {
      return NextResponse.json(
        { error: 'Invalid QR code data' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verify token
    const tokenHash = hashToken(token)
    const { data: validToken, error: tokenError } = await supabase
      .from('qr_tokens')
      .select('*')
      .eq('store_id', storeId)
      .eq('token_hash', tokenHash)
      .eq('is_used', false)
      .gte('valid_until', new Date().toISOString())
      .single()

    if (tokenError || !validToken) {
      return NextResponse.json(
        { error: 'Invalid or expired QR code' },
        { status: 400 }
      )
    }

    // Get employee record
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('*')
      .eq('user_id', user.id)
      .eq('store_id', storeId)
      .single()

    if (employeeError || !employee) {
      return NextResponse.json(
        { error: 'You are not assigned to this store' },
        { status: 403 }
      )
    }

    // Check if already checked in today
    const today = new Date().toISOString().split('T')[0]
    const { data: existingRecord } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('work_date', today)
      .is('check_out_time', null)
      .single()

    if (existingRecord) {
      // Check out
      const { error: checkoutError } = await supabase
        .from('attendance_records')
        .update({
          check_out_time: new Date().toISOString(),
          total_hours: Math.round(
            (new Date().getTime() - new Date(existingRecord.check_in_time).getTime()) / 
            (1000 * 60 * 60) * 100
          ) / 100,
        })
        .eq('id', existingRecord.id)

      if (checkoutError) {
        throw checkoutError
      }

      // Mark token as used
      await supabase
        .from('qr_tokens')
        .update({
          is_used: true,
          used_by: employee.id,
          used_at: new Date().toISOString(),
        })
        .eq('id', validToken.id)

      return NextResponse.json({
        type: 'checkout',
        message: 'Checked out successfully',
        record: {
          checkInTime: existingRecord.check_in_time,
          checkOutTime: new Date().toISOString(),
        },
      })
    } else {
      // Check in
      const { data: newRecord, error: checkinError } = await supabase
        .from('attendance_records')
        .insert({
          employee_id: employee.id,
          store_id: storeId,
          check_in_time: new Date().toISOString(),
          work_date: today,
          status: 'present',
          check_in_method: 'qr',
          qr_validation_token: tokenHash,
          location_lat: location?.latitude,
          location_lng: location?.longitude,
          location_accuracy: location?.accuracy,
        })
        .select()
        .single()

      if (checkinError) {
        throw checkinError
      }

      // Mark token as used
      await supabase
        .from('qr_tokens')
        .update({
          is_used: true,
          used_by: employee.id,
          used_at: new Date().toISOString(),
        })
        .eq('id', validToken.id)

      return NextResponse.json({
        type: 'checkin',
        message: 'Checked in successfully',
        record: {
          checkInTime: newRecord.check_in_time,
          workDate: newRecord.work_date,
        },
      })
    }
  } catch (error) {
    console.error('QR checkin error:', error)
    return NextResponse.json(
      { error: 'Failed to process check-in' },
      { status: 500 }
    )
  }
}