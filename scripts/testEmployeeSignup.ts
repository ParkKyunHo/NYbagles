#!/usr/bin/env node

import dotenv from 'dotenv'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

// Check for required environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables')
  process.exit(1)
}

// Initialize Supabase Admin Client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

async function testEmployeeSignup() {
  console.log('🚀 Testing employee signup flow...')

  try {
    // 1. Find a test store
    const { data: stores, error: storeError } = await supabaseAdmin
      .from('stores')
      .select('*')
      .eq('is_active', true)
      .limit(1)

    if (storeError || !stores || stores.length === 0) {
      console.error('❌ No active stores found')
      return
    }

    const testStore = stores[0]
    console.log(`✅ Found store: ${testStore.name} (${testStore.code})`)

    // 2. Create a test signup request
    const testRequest = {
      email: `test-employee-${Date.now()}@example.com`,
      full_name: `테스트 직원 ${Date.now()}`,
      phone: '010-1234-5678',
      store_id: testStore.id,
      store_code: testStore.code,
      verification_code: 'TEST123',
      verified: true,
      verified_at: new Date().toISOString(),
      status: 'verified'
    }

    const { data: request, error: requestError } = await supabaseAdmin
      .from('employee_signup_requests')
      .insert(testRequest)
      .select()
      .single()

    if (requestError) {
      console.error('❌ Error creating signup request:', requestError)
      return
    }

    console.log('✅ Created signup request:', request.id)
    console.log('   Email:', request.email)
    console.log('   Name:', request.full_name)
    console.log('   Store:', testStore.name)
    console.log('   Status:', request.status)

    console.log('\n📋 Next Steps:')
    console.log('1. Login as admin/manager')
    console.log('2. Go to /dashboard/employee-requests')
    console.log('3. Approve or reject the test request')

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

testEmployeeSignup()