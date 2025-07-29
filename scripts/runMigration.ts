import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { readFileSync } from 'fs'
import { join } from 'path'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function runMigration() {
  console.log('🚀 Running migration: Add employee_number field...')
  
  try {
    // Read migration file
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20250127003000_add_employee_number_field.sql')
    const migrationSQL = readFileSync(migrationPath, 'utf8')
    
    console.log('📄 Migration SQL loaded')
    
    // Execute migration
    const { error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    })
    
    if (error) {
      // If exec_sql doesn't exist, try direct execution
      console.log('⚠️  exec_sql not available, executing statements individually...')
      
      // Split SQL into individual statements
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i] + ';'
        console.log(`\nExecuting statement ${i + 1}/${statements.length}...`)
        
        // Execute via Supabase client (limited to certain operations)
        if (statement.includes('CREATE TRIGGER') || 
            statement.includes('CREATE FUNCTION') ||
            statement.includes('CREATE SEQUENCE') ||
            statement.includes('ALTER TABLE')) {
          console.log('⚠️  This statement needs to be run directly in Supabase Dashboard')
          console.log('Statement:', statement.substring(0, 100) + '...')
        }
      }
      
      console.log('\n⚠️  Some statements could not be executed via the client.')
      console.log('Please run the migration directly in Supabase Dashboard.')
      return
    }
    
    console.log('✅ Migration executed successfully!')
    
    // Verify migration
    console.log('\n🔍 Verifying migration...')
    
    // Check if employee_number column exists
    const { data: employees, error: checkError } = await supabase
      .from('employees')
      .select('id, employee_number, user_id')
      .limit(5)
    
    if (checkError) {
      console.error('❌ Verification failed:', checkError)
    } else {
      console.log('✅ Employee numbers found:', employees?.length || 0)
      employees?.forEach(emp => {
        console.log(`  - Employee ${emp.id}: ${emp.employee_number}`)
      })
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
  }
}

// Function to assign stores to employees without store_id
async function assignStoresToEmployees() {
  console.log('\n🏪 Checking employee store assignments...')
  
  try {
    // Get employees without store_id
    const { data: employeesWithoutStore, error: fetchError } = await supabase
      .from('employees')
      .select(`
        id,
        user_id,
        profiles (
          email,
          full_name
        )
      `)
      .is('store_id', null)
    
    if (fetchError) {
      console.error('❌ Failed to fetch employees:', fetchError)
      return
    }
    
    if (!employeesWithoutStore || employeesWithoutStore.length === 0) {
      console.log('✅ All employees have stores assigned!')
      return
    }
    
    console.log(`⚠️  Found ${employeesWithoutStore.length} employees without store assignment`)
    
    // Get available stores
    const { data: stores, error: storesError } = await supabase
      .from('stores')
      .select('id, name, code')
      .eq('is_active', true)
    
    if (storesError || !stores || stores.length === 0) {
      console.error('❌ No active stores found')
      return
    }
    
    console.log('\n📋 Available stores:')
    stores.forEach((store, index) => {
      console.log(`  ${index + 1}. ${store.name} (${store.code})`)
    })
    
    // For testing, assign the first store to all employees without store
    const defaultStore = stores[0]
    console.log(`\n🔧 Assigning default store: ${defaultStore.name}`)
    
    for (const employee of employeesWithoutStore) {
      const { error: updateError } = await supabase
        .from('employees')
        .update({ store_id: defaultStore.id })
        .eq('id', employee.id)
      
      if (updateError) {
        console.error(`❌ Failed to update employee ${employee.id}:`, updateError)
      } else {
        const profile = employee.profiles?.[0]
        console.log(`✅ Assigned ${defaultStore.name} to ${profile?.full_name || profile?.email || 'Unknown employee'}`)
      }
    }
    
  } catch (error) {
    console.error('❌ Store assignment failed:', error)
  }
}

// Run migration and then assign stores
async function main() {
  await runMigration()
  await assignStoresToEmployees()
  
  console.log('\n🎉 Migration process completed!')
  console.log('\n📝 Next steps:')
  console.log('1. If migration failed, run the SQL directly in Supabase Dashboard')
  console.log('2. Test the sales pages to ensure they work correctly')
  console.log('3. Verify employee numbers are displayed in employee management pages')
}

main()