import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/permissions'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await requireRole(['super_admin', 'admin', 'manager'])

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || 'pending'
    const storeId = searchParams.get('storeId')

    const supabase = await createClient()

    let query = supabase
      .from('employee_signup_requests')
      .select(`
        *,
        stores (
          id,
          name,
          code
        )
      `)
      .eq('status', status)
      .order('created_at', { ascending: false })

    if (storeId) {
      query = query.eq('store_id', storeId)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({ requests: data })
  } catch (error) {
    console.error('Get signup requests error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch signup requests' },
      { status: 500 }
    )
  }
}