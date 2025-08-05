import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    // Check if service role key exists
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({
        success: false,
        error: 'SUPABASE_SERVICE_ROLE_KEY not found in environment variables',
        hasKey: false
      })
    }

    // Try to create admin client
    const adminClient = createAdminClient()

    // Test the admin client by listing users (should work with service role)
    const { data, error } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1
    })

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to list users with admin client',
        details: error.message,
        hasKey: true,
        keyLength: process.env.SUPABASE_SERVICE_ROLE_KEY.length
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Admin client is working correctly',
      hasKey: true,
      keyLength: process.env.SUPABASE_SERVICE_ROLE_KEY.length,
      userCount: data?.users?.length || 0
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'Unexpected error',
      details: error?.message || 'Unknown error',
      hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    })
  }
}