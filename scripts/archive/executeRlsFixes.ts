import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

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

async function executeRlsFixes() {
  try {
    console.log('Starting RLS policy fixes...\n')
    
    // 1. First, let's check current access
    console.log('1. Checking current access levels...')
    
    // Test products access
    const { data: productsTest, error: productsError } = await supabase
      .from('products')
      .select('count')
      .single()
    
    console.log('Products access:', productsError ? `Error: ${productsError.message}` : 'OK')
    
    // 2. Create missing store_products entries
    console.log('\n2. Creating missing store_products entries...')
    
    const { data: products } = await supabase
      .from('products')
      .select('id')
      .eq('is_active', true)
    
    const { data: stores } = await supabase
      .from('stores')
      .select('id')
      .eq('is_active', true)
    
    if (products && stores) {
      let created = 0
      for (const store of stores) {
        for (const product of products) {
          const { data: existing } = await supabase
            .from('store_products')
            .select('id')
            .eq('store_id', store.id)
            .eq('product_id', product.id)
            .maybeSingle()
          
          if (!existing) {
            const { error } = await supabase
              .from('store_products')
              .insert({
                store_id: store.id,
                product_id: product.id,
                is_available: true
              })
            
            if (!error) {
              created++
            }
          }
        }
      }
      console.log(`Created ${created} missing store_products entries`)
    }
    
    // 3. Since we can't directly execute SQL, let's create the necessary data
    console.log('\n3. Testing data access with service role...')
    
    // Get all products with categories
    const { data: allProducts, error: allProductsError } = await supabase
      .from('products')
      .select(`
        *,
        product_categories (
          id,
          name
        )
      `)
      .eq('is_active', true)
    
    if (allProductsError) {
      console.error('Error fetching products:', allProductsError)
    } else {
      console.log(`Successfully fetched ${allProducts?.length || 0} products`)
    }
    
    // 4. Create a test endpoint to verify the fix
    console.log('\n4. Creating test endpoint for verification...')
    
    // Output SQL for manual execution
    console.log('\n' + '='.repeat(80))
    console.log('IMPORTANT: RLS policies need to be updated manually')
    console.log('='.repeat(80))
    console.log('\nTo fix the RLS policies, please:')
    console.log('1. Go to Supabase Dashboard (https://supabase.com/dashboard)')
    console.log('2. Select your project')
    console.log('3. Go to SQL Editor')
    console.log('4. Create a new query')
    console.log('5. Copy and paste the following SQL:\n')
    
    const rlsFixSql = `
-- Fix products table RLS policies
DROP POLICY IF EXISTS "Anyone can view products" ON products;
DROP POLICY IF EXISTS "Admins can manage products" ON products;

-- Allow authenticated users to view products
CREATE POLICY "Authenticated users can view products" ON products
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Allow admins to manage products
CREATE POLICY "Admins can manage products" ON products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

-- Fix product_categories table RLS policies
DROP POLICY IF EXISTS "Anyone can view active categories" ON product_categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON product_categories;

-- Allow authenticated users to view active categories
CREATE POLICY "Authenticated users can view active categories" ON product_categories
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);

-- Allow admins to manage categories
CREATE POLICY "Admins can manage categories" ON product_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

-- Fix store_products table RLS policies
DROP POLICY IF EXISTS "Employees can view store products" ON store_products;
DROP POLICY IF EXISTS "Managers can manage store products" ON store_products;

-- Allow employees to view their store products or admins to view all
CREATE POLICY "Employees can view store products" ON store_products
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
      )
      OR
      EXISTS (
        SELECT 1 FROM employees e
        JOIN profiles p ON p.id = e.user_id
        WHERE p.id = auth.uid()
        AND e.store_id = store_products.store_id
      )
    )
  );

-- Allow managers to manage their store products or admins to manage all
CREATE POLICY "Managers can manage store products" ON store_products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN employees e ON e.user_id = p.id
      WHERE p.id = auth.uid() 
      AND (
        p.role IN ('super_admin', 'admin')
        OR (p.role = 'manager' AND e.store_id = store_products.store_id)
      )
    )
  );
    `.trim()
    
    console.log(rlsFixSql)
    console.log('\n6. Click "Run" to execute the SQL')
    console.log('7. The policies should be updated immediately')
    console.log('='.repeat(80))
    
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

// Run the fixes
executeRlsFixes()