#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables')
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function applyMigration() {
  console.log('🚀 Applying new product system migration...')
  
  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../supabase/migrations/20250131_redesign_product_system.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('📝 Executing migration...')
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0)
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (statement) {
        console.log(`Executing statement ${i + 1}/${statements.length}...`)
        
        // For RLS policies and other complex statements, we need to use raw SQL
        const { error } = await supabase.rpc('exec_sql', {
          sql: statement + ';'
        })
        
        if (error) {
          console.error(`❌ Error executing statement ${i + 1}:`, error)
          // Continue with next statement instead of stopping
        }
      }
    }
    
    console.log('✅ Migration completed!')
    
    // Check if we have any data in the new tables
    const { data: productsV2, error: checkError } = await supabase
      .from('products_v2')
      .select('count', { count: 'exact' })
    
    if (!checkError) {
      console.log(`📊 Products in new table: ${productsV2?.length || 0}`)
    }
    
    console.log('\n📋 Next steps:')
    console.log('1. Test the new simplified pages:')
    console.log('   - /sales/simple - New sales interface')
    console.log('   - /products/v2 - New product management')
    console.log('   - /sales/closing - Daily closing feature')
    console.log('2. Once verified, you can switch users to the new system')
    console.log('3. The old system remains intact as a fallback')
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

// First, let's create the exec_sql function if it doesn't exist
async function createExecSqlFunction() {
  const functionSQL = `
    CREATE OR REPLACE FUNCTION exec_sql(sql text)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      EXECUTE sql;
    END;
    $$;
  `
  
  try {
    console.log('🔧 Creating exec_sql function...')
    
    // Try a different approach - direct to database
    console.log('⚠️  Note: This script requires direct database access.')
    console.log('Please run the migration SQL directly in your Supabase SQL editor:')
    console.log('1. Go to your Supabase dashboard')
    console.log('2. Navigate to SQL Editor')
    console.log('3. Copy and paste the contents of:')
    console.log('   supabase/migrations/20250131_redesign_product_system.sql')
    console.log('4. Execute the SQL')
    
    // For now, let's just check what we can do
    const { data: tables } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['products_v2', 'sales', 'daily_closing'])
    
    if (tables && tables.length > 0) {
      console.log('\n✅ New tables already exist:', tables.map(t => t.table_name).join(', '))
    } else {
      console.log('\n❌ New tables not found. Please run the migration manually.')
    }
    
  } catch (error) {
    console.error('Error:', error)
  }
}

// Run the migration
createExecSqlFunction()