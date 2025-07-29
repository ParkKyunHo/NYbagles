import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/permissions'
import { generateTOTP, hashToken } from '@/lib/utils/crypto'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { storeId } = body

    if (!storeId) {
      return NextResponse.json(
        { error: 'Store ID is required' },
        { status: 400 }
      )
    }

    // Check permissions
    await requireRole(['super_admin', 'admin', 'manager'])

    const supabase = await createClient()

    // Get store details
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single()

    if (storeError || !store) {
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 404 }
      )
    }

    // Generate TOTP token
    const token = generateTOTP(store.qr_secret)
    const tokenHash = hashToken(token)

    // Store token hash for validation
    const { error: tokenError } = await supabase
      .from('qr_tokens')
      .insert({
        store_id: storeId,
        token_hash: tokenHash,
        valid_until: new Date(Date.now() + 30000).toISOString(), // 30 seconds
      })

    if (tokenError) {
      throw tokenError
    }

    // Generate QR data
    const qrData = {
      storeId: store.id,
      storeCode: store.code,
      token: token,
      timestamp: Date.now(),
    }

    return NextResponse.json({
      qrData: JSON.stringify(qrData),
      expiresAt: new Date(Date.now() + 30000).toISOString(),
    })
  } catch (error) {
    console.error('QR generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate QR code' },
      { status: 500 }
    )
  }
}