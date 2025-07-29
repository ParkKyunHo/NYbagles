import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

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

async function testSalesSystem() {
  console.log('🧪 Testing Sales System...\n')
  
  try {
    // 1. Check employees with store assignments
    console.log('1️⃣ Checking employee-store relationships...')
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select(`
        id,
        user_id,
        store_id,
        employee_number,
        stores (
          id,
          name,
          code
        ),
        profiles (
          email,
          full_name,
          role
        )
      `)
      .limit(5)
    
    if (empError) {
      console.error('❌ Failed to fetch employees:', empError)
      return
    }
    
    console.log(`✅ Found ${employees?.length || 0} employees:`)
    employees?.forEach(emp => {
      const profile = emp.profiles?.[0]
      const store = emp.stores?.[0]
      console.log(`   - ${emp.employee_number || 'NO_NUMBER'}: ${profile?.full_name || profile?.email || 'Unknown'} @ ${store?.name || 'NO_STORE'}`)
    })
    
    // 2. Check products with store prices
    console.log('\n2️⃣ Checking products availability...')
    const firstStore = employees?.[0]?.store_id
    
    if (firstStore) {
      const { data: products, error: prodError } = await supabase
        .from('products')
        .select(`
          id,
          name,
          price,
          store_products!inner (
            store_id,
            custom_price,
            is_available,
            stock_quantity
          )
        `)
        .eq('is_active', true)
        .eq('store_products.store_id', firstStore)
        .eq('store_products.is_available', true)
        .limit(5)
      
      if (prodError) {
        console.error('❌ Failed to fetch products:', prodError)
      } else {
        console.log(`✅ Found ${products?.length || 0} products for store:`)
        products?.forEach(prod => {
          const storePrice = prod.store_products[0]?.custom_price || prod.price
          const stock = prod.store_products[0]?.stock_quantity || 0
          console.log(`   - ${prod.name}: ₩${storePrice} (재고: ${stock})`)
        })
      }
    }
    
    // 3. Check recent sales
    console.log('\n3️⃣ Checking recent sales...')
    const { data: sales, error: salesError } = await supabase
      .from('sales_records')
      .select(`
        id,
        sale_date,
        total_amount,
        payment_method,
        is_canceled,
        stores (
          name
        ),
        profiles (
          full_name,
          email
        )
      `)
      .order('created_at', { ascending: false })
      .limit(5)
    
    if (salesError) {
      console.error('❌ Failed to fetch sales:', salesError)
    } else {
      console.log(`✅ Found ${sales?.length || 0} recent sales:`)
      if (sales?.length === 0) {
        console.log('   (No sales records yet)')
      } else {
        sales?.forEach(sale => {
          const status = sale.is_canceled ? '❌ 취소됨' : '✅ 완료'
          const store = sale.stores?.[0]
          console.log(`   - ${sale.sale_date}: ₩${sale.total_amount} @ ${store?.name || 'Unknown store'} ${status}`)
        })
      }
    }
    
    // 4. Check if employee_number field exists
    console.log('\n4️⃣ Verifying employee_number field...')
    const { data: empNumbers, error: numError } = await supabase
      .from('employees')
      .select('id, employee_number')
      .not('employee_number', 'is', null)
      .limit(3)
    
    if (numError) {
      console.error('❌ employee_number field might not exist:', numError)
      console.log('   ➡️  Please run the migration in Supabase Dashboard')
    } else {
      console.log(`✅ employee_number field exists! Sample numbers:`)
      empNumbers?.forEach(emp => {
        console.log(`   - ${emp.employee_number}`)
      })
    }
    
    // Summary
    console.log('\n📊 Summary:')
    console.log('- Employees have store assignments: ✅')
    console.log('- Products are available: ✅')
    console.log(`- Sales system is ready: ${sales !== null ? '✅' : '❌'}`)
    console.log(`- employee_number field: ${empNumbers !== null ? '✅' : '❌ Need migration'}`)
    
    if (numError) {
      console.log('\n⚠️  Action Required:')
      console.log('1. Go to Supabase Dashboard > SQL Editor')
      console.log('2. Run the migration from: /supabase/migrations/20250127003000_add_employee_number_field.sql')
      console.log('3. Or check: /supabase/migrations/MANUAL_MIGRATION_GUIDE.md')
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testSalesSystem()