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

async function checkTables() {
  console.log('🔍 Checking database tables...')

  try {
    // Check profiles table
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .limit(1)

    if (profilesError) {
      console.error('❌ profiles table error:', profilesError.message)
    } else {
      console.log('✅ profiles table exists')
    }

    // Check regions table
    const { data: regions, error: regionsError } = await supabaseAdmin
      .from('regions')
      .select('*')
      .limit(1)

    if (regionsError) {
      console.error('❌ regions table error:', regionsError.message)
    } else {
      console.log('✅ regions table exists')
    }

    // Check store_categories table
    const { data: categories, error: categoriesError } = await supabaseAdmin
      .from('store_categories')
      .select('*')
      .limit(1)

    if (categoriesError) {
      console.error('❌ store_categories table error:', categoriesError.message)
    } else {
      console.log('✅ store_categories table exists')
    }

    // Check stores table
    const { data: stores, error: storesError } = await supabaseAdmin
      .from('stores')
      .select('*')
      .limit(1)

    if (storesError) {
      console.error('❌ stores table error:', storesError.message)
    } else {
      console.log('✅ stores table exists')
    }

    // Check employees table
    const { data: employees, error: employeesError } = await supabaseAdmin
      .from('employees')
      .select('*')
      .limit(1)

    if (employeesError) {
      console.error('❌ employees table error:', employeesError.message)
    } else {
      console.log('✅ employees table exists')
    }

    console.log('\n📊 Database check completed!')

  } catch (error) {
    console.error('❌ Error checking tables:', error)
  }
}

checkTables()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })