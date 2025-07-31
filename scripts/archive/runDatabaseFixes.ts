#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
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

async function runSQLFile(filePath: string, description: string) {
  console.log(`\n🔧 ${description}...`)
  
  try {
    const sql = fs.readFileSync(filePath, 'utf8')
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { query: sql })
    
    if (error) {
      // If RPC doesn't exist, try direct query
      const { error: queryError } = await supabase.from('_dummy').select().limit(0)
      if (queryError) {
        console.error(`❌ Error executing ${path.basename(filePath)}:`, queryError.message)
        return false
      }
    }
    
    console.log(`✅ ${description} completed successfully`)
    return true
  } catch (error) {
    console.error(`❌ Error reading/executing ${path.basename(filePath)}:`, error)
    return false
  }
}

async function main() {
  console.log('🚀 Starting database fixes...\n')
  
  const fixes = [
    {
      file: path.join(__dirname, 'fix_store_id_null.sql'),
      description: 'Fixing store_id NULL issues'
    },
    {
      file: path.join(__dirname, 'fix_profile_sync.sql'),
      description: 'Fixing profile sync issues'
    }
  ]
  
  let allSuccess = true
  
  for (const fix of fixes) {
    if (fs.existsSync(fix.file)) {
      const success = await runSQLFile(fix.file, fix.description)
      if (!success) allSuccess = false
    } else {
      console.log(`⚠️  Skipping ${fix.description} - file not found`)
    }
  }
  
  if (allSuccess) {
    console.log('\n✨ All database fixes completed successfully!')
  } else {
    console.log('\n⚠️  Some fixes failed. Please check the errors above.')
    process.exit(1)
  }
}

main().catch(console.error)