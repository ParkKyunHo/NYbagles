#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface ValidationResult {
  test: string
  passed: boolean
  message: string
}

async function validateStoreAssignments(): Promise<ValidationResult> {
  try {
    const { data: employees, error } = await supabase
      .from('employees')
      .select('id, user_id, store_id')
    
    if (error) throw error
    
    const withoutStore = employees?.filter(e => !e.store_id) || []
    
    return {
      test: 'Store ID Assignment',
      passed: withoutStore.length === 0,
      message: withoutStore.length === 0 
        ? `✅ All ${employees?.length || 0} employees have store assignments`
        : `❌ ${withoutStore.length} employees without store assignments`
    }
  } catch (error) {
    return {
      test: 'Store ID Assignment',
      passed: false,
      message: `❌ Error checking store assignments: ${error}`
    }
  }
}

async function validateProfileSync(): Promise<ValidationResult> {
  try {
    // Check for auth users without profiles
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()
    if (authError) throw authError
    
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id')
    
    if (profileError) throw profileError
    
    const profileIds = new Set(profiles?.map(p => p.id) || [])
    const missingProfiles = authUsers.users.filter(u => !profileIds.has(u.id))
    
    return {
      test: 'Profile Synchronization',
      passed: missingProfiles.length === 0,
      message: missingProfiles.length === 0
        ? `✅ All ${authUsers.users.length} auth users have profiles`
        : `❌ ${missingProfiles.length} auth users without profiles`
    }
  } catch (error) {
    return {
      test: 'Profile Synchronization',
      passed: false,
      message: `❌ Error checking profile sync: ${error}`
    }
  }
}

async function validateDatabaseConstraints(): Promise<ValidationResult> {
  try {
    // Try to insert an employee without store_id (should fail)
    const { error } = await supabase
      .from('employees')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000000',
        role: 'employee',
        is_active: true,
        store_id: null
      } as any)
    
    // We expect this to fail
    const constraintExists = error !== null && error.message.includes('null value')
    
    // Clean up if somehow it succeeded
    if (!error) {
      await supabase
        .from('employees')
        .delete()
        .eq('user_id', '00000000-0000-0000-0000-000000000000')
    }
    
    return {
      test: 'Database Constraints',
      passed: constraintExists,
      message: constraintExists
        ? '✅ store_id NOT NULL constraint is active'
        : '❌ store_id NOT NULL constraint is missing'
    }
  } catch (error) {
    return {
      test: 'Database Constraints',
      passed: false,
      message: `❌ Error checking constraints: ${error}`
    }
  }
}

async function main() {
  console.log('🔍 Validating database fixes...\n')
  
  const results: ValidationResult[] = []
  
  // Run all validations
  results.push(await validateStoreAssignments())
  results.push(await validateProfileSync())
  results.push(await validateDatabaseConstraints())
  
  // Display results
  console.log('📊 Validation Results:\n')
  results.forEach(result => {
    console.log(`${result.test}: ${result.message}`)
  })
  
  const allPassed = results.every(r => r.passed)
  
  if (allPassed) {
    console.log('\n✨ All validations passed!')
  } else {
    console.log('\n⚠️  Some validations failed. Please run the fix scripts.')
    process.exit(1)
  }
}

main().catch(console.error)