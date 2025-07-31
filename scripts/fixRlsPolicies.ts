import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { readFileSync } from 'fs'
import { join } from 'path'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function executeSqlFile() {
  try {
    console.log('Reading SQL file...')
    const sqlFilePath = join(__dirname, '../supabase/migrations/20250131000001_fix_rls_policies.sql')
    const sqlContent = readFileSync(sqlFilePath, 'utf-8')
    
    console.log('Executing SQL to fix RLS policies...')
    
    // Split SQL content by semicolons but keep them for execution
    const statements = sqlContent
      .split(/;\s*\n/)
      .filter(stmt => stmt.trim().length > 0)
      .map(stmt => stmt.trim() + ';')
    
    let successCount = 0
    let errorCount = 0
    
    for (const statement of statements) {
      // Skip comments
      if (statement.trim().startsWith('--') || statement.trim() === ';') {
        continue
      }
      
      try {
        console.log(`Executing: ${statement.substring(0, 50)}...`)
        
        const { data, error } = await supabase.rpc('execute_sql', {
          sql: statement
        }).single()
        
        if (error) {
          // Try direct execution if RPC fails
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/execute_sql`, {
            method: 'POST',
            headers: {
              'apikey': supabaseServiceRoleKey,
              'Authorization': `Bearer ${supabaseServiceRoleKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sql: statement })
          })
          
          if (!response.ok) {
            // If RPC doesn't exist, we'll need to use a different approach
            console.log('RPC method not available, using alternative approach...')
            
            // For now, we'll output the SQL for manual execution
            console.log('\n=== SQL Statement to execute manually ===')
            console.log(statement)
            console.log('=========================================\n')
            errorCount++
          } else {
            successCount++
          }
        } else {
          successCount++
        }
      } catch (err) {
        console.error(`Error executing statement: ${err}`)
        errorCount++
      }
    }
    
    console.log(`\nExecution complete: ${successCount} successful, ${errorCount} errors`)
    
    // Test authentication
    console.log('\nTesting authentication info...')
    const { data: authTest, error: authError } = await supabase
      .from('profiles')
      .select('id, email, role')
      .limit(1)
    
    if (authError) {
      console.error('Auth test error:', authError)
    } else {
      console.log('Auth test successful:', authTest)
    }
    
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

// Alternative approach: Create individual functions to fix policies
async function fixRlsPoliciesDirect() {
  try {
    console.log('Fixing RLS policies using direct API calls...')
    
    // Test if we can query products
    console.log('\n1. Testing products table access...')
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name')
      .limit(5)
    
    if (productsError) {
      console.error('Products query error:', productsError)
    } else {
      console.log(`Found ${products?.length || 0} products`)
    }
    
    // Test if we can query categories
    console.log('\n2. Testing product_categories table access...')
    const { data: categories, error: categoriesError } = await supabase
      .from('product_categories')
      .select('id, name')
      .limit(5)
    
    if (categoriesError) {
      console.error('Categories query error:', categoriesError)
    } else {
      console.log(`Found ${categories?.length || 0} categories`)
    }
    
    // Test if we can query store_products
    console.log('\n3. Testing store_products table access...')
    const { data: storeProducts, error: storeProductsError } = await supabase
      .from('store_products')
      .select('id, store_id, product_id')
      .limit(5)
    
    if (storeProductsError) {
      console.error('Store products query error:', storeProductsError)
    } else {
      console.log(`Found ${storeProducts?.length || 0} store products`)
    }
    
    // Check missing store_products entries
    console.log('\n4. Checking for missing store_products entries...')
    const { data: allProducts } = await supabase
      .from('products')
      .select('id, name')
      .eq('is_active', true)
    
    const { data: allStores } = await supabase
      .from('stores')
      .select('id, name')
      .eq('is_active', true)
    
    if (allProducts && allStores) {
      console.log(`Total products: ${allProducts.length}`)
      console.log(`Total stores: ${allStores.length}`)
      console.log(`Expected store_products entries: ${allProducts.length * allStores.length}`)
      
      // Create missing entries
      for (const store of allStores) {
        for (const product of allProducts) {
          const { data: existing } = await supabase
            .from('store_products')
            .select('id')
            .eq('store_id', store.id)
            .eq('product_id', product.id)
            .single()
          
          if (!existing) {
            console.log(`Creating store_product for ${store.name} - ${product.name}`)
            const { error: insertError } = await supabase
              .from('store_products')
              .insert({
                store_id: store.id,
                product_id: product.id,
                is_available: true
              })
            
            if (insertError) {
              console.error('Insert error:', insertError)
            }
          }
        }
      }
    }
    
    console.log('\nRLS policy fix script completed!')
    console.log('\nPlease execute the SQL file manually in Supabase Dashboard:')
    console.log('1. Go to Supabase Dashboard > SQL Editor')
    console.log('2. Copy the contents of: supabase/migrations/20250131000001_fix_rls_policies.sql')
    console.log('3. Paste and run the SQL')
    
  } catch (error) {
    console.error('Error:', error)
  }
}

// Run the direct fix approach
fixRlsPoliciesDirect()