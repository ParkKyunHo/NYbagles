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
    const { reason } = body

    const supabase = await createClient()

    // Update signup request
    const { error: updateError } = await supabase
      .from('employee_signup_requests')
      .update({
        approved: false,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        status: 'rejected',
        rejection_reason: reason,
      })
      .eq('id', params.id)
      .eq('status', 'verified')

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to reject signup request' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      message: 'Signup request rejected successfully',
    })
  } catch (error) {
    console.error('Reject signup request error:', error)
    return NextResponse.json(
      { error: 'Failed to reject signup request' },
      { status: 500 }
    )
  }
}