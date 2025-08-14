#!/usr/bin/env npx tsx

/**
 * Test script for employees table query
 * Verifies that the employees table can be queried without errors
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

// Create clients
const anonClient = createClient(supabaseUrl, supabaseAnonKey)
const adminClient = createClient(supabaseUrl, supabaseServiceKey)

async function testEmployeesQuery() {
  console.log('Testing employees table queries...\n')

  try {
    // Test 1: Direct query with admin client
    console.log('Test 1: Direct query with admin client')
    const { data: employees1, error: error1 } = await adminClient
      .from('employees')
      .select('id, user_id, store_id')
      .limit(5)

    if (error1) {
      console.error('❌ Admin client query failed:', error1)
    } else {
      console.log('✅ Admin client query successful:', employees1?.length, 'rows')
    }

    // Test 2: Query with profiles join
    console.log('\nTest 2: Query with profiles join')
    const { data: employees2, error: error2 } = await adminClient
      .from('employees')
      .select(`
        id,
        user_id,
        store_id,
        profiles!employees_user_id_fkey (
          id,
          full_name,
          email,
          role
        )
      `)
      .limit(5)

    if (error2) {
      console.error('❌ Join query failed:', error2)
    } else {
      console.log('✅ Join query successful:', employees2?.length, 'rows')
      if (employees2 && employees2.length > 0) {
        console.log('Sample data:', JSON.stringify(employees2[0], null, 2))
      }
    }

    // Test 3: Query with stores join
    console.log('\nTest 3: Query with stores join')
    const { data: employees3, error: error3 } = await adminClient
      .from('employees')
      .select(`
        id,
        user_id,
        store_id,
        stores (
          id,
          name,
          code
        )
      `)
      .limit(5)

    if (error3) {
      console.error('❌ Stores join query failed:', error3)
    } else {
      console.log('✅ Stores join query successful:', employees3?.length, 'rows')
    }

    // Test 4: Test with anon client (RLS)
    console.log('\nTest 4: Query with anon client (RLS enabled)')
    
    // First, sign in as a test user
    const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({
      email: 'admin@nylovebagel.com',
      password: 'admin123456'
    })

    if (authError) {
      console.error('❌ Authentication failed:', authError)
    } else {
      console.log('✅ Authenticated as:', authData.user?.email)

      // Try to query employees
      const { data: employees4, error: error4 } = await anonClient
        .from('employees')
        .select('store_id')
        .eq('user_id', authData.user?.id)

      if (error4) {
        console.error('❌ RLS query failed:', error4)
      } else {
        console.log('✅ RLS query successful:', employees4)
      }
    }

    // Test 5: Check RLS policies
    console.log('\nTest 5: Check RLS policies')
    const { data: policies, error: policiesError } = await adminClient
      .rpc('pg_policies')
      .eq('tablename', 'employees')

    if (policiesError) {
      // Try alternative query
      const { data: altPolicies, error: altError } = await adminClient
        .from('pg_policies')
        .select('*')
        .eq('tablename', 'employees')

      if (altError) {
        console.log('⚠️ Could not fetch policies (this is normal)')
      } else {
        console.log('RLS Policies:', altPolicies)
      }
    } else {
      console.log('RLS Policies:', policies)
    }

    console.log('\n✅ All tests completed!')

  } catch (error) {
    console.error('Unexpected error:', error)
  } finally {
    // Sign out
    await anonClient.auth.signOut()
  }
}

// Run the test
testEmployeesQuery()
  .then(() => {
    console.log('\nTest script finished')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })