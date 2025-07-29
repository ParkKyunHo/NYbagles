import { createClient } from '@supabase/supabase-js'
import { generateSecret } from '@/lib/utils/crypto'

// Initialize Supabase Admin Client - will be created when seedDatabase is called
let supabaseAdmin: ReturnType<typeof createClient>

export interface SeedConfig {
  createSuperAdmin?: boolean
  createTestStores?: boolean
  createSampleEmployees?: boolean
  superAdminEmail?: string
  superAdminPassword?: string
}

const defaultConfig: SeedConfig = {
  createSuperAdmin: true,
  createTestStores: true,
  createSampleEmployees: true,
  superAdminEmail: 'admin@nylovebagel.com',
  superAdminPassword: 'Admin123!@#', // Should be changed immediately after setup
}

export async function seedDatabase(config: SeedConfig = defaultConfig) {
  console.log('🌱 Starting database seeding...')

  // Initialize Supabase Admin Client with environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing required environment variables')
  }

  supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  try {
    // 1. Create Super Admin
    if (config.createSuperAdmin) {
      await createSuperAdmin(config.superAdminEmail!, config.superAdminPassword!)
    }

    // 2. Create Test Stores
    if (config.createTestStores) {
      await createTestStores()
    }

    // 3. Create Sample Employees
    if (config.createSampleEmployees) {
      await createSampleEmployees()
    }

    console.log('✅ Database seeding completed successfully!')
  } catch (error) {
    console.error('❌ Error during seeding:', error)
    throw error
  }
}

async function createSuperAdmin(email: string, password: string) {
  console.log('Creating super admin user...')

  // Check if user already exists
  const { data: existingUser } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (existingUser) {
    console.log('Super admin already exists, skipping...')
    return
  }

  // Create auth user
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: 'System Administrator',
      role: 'super_admin'
    }
  })

  if (authError) {
    console.error('Auth error details:', authError)
    throw authError
  }

  console.log('✓ Super admin created:', email)
}

async function createTestStores() {
  console.log('Creating test stores...')

  // Check if Seoul region exists
  const { data: existingRegion } = await supabaseAdmin
    .from('regions')
    .select('id')
    .eq('code', 'SEOUL')
    .single()

  let regionId = existingRegion?.id

  if (!regionId) {
    // Create Seoul region
    const { data: region, error: regionError } = await supabaseAdmin
      .from('regions')
      .insert({
        name: '서울',
        code: 'SEOUL',
        is_active: true
      })
      .select()
      .single()

    if (regionError) throw regionError
    regionId = region.id
    console.log('✓ Created region: 서울')
  }

  // Create store categories
  const categories = [
    { name: '강남구', description: '서울 강남구 지역 매장들' },
    { name: '종로구', description: '서울 종로구 지역 매장들' },
    { name: '마포구', description: '서울 마포구 지역 매장들' }
  ]

  for (const category of categories) {
    if (!regionId) throw new Error('Region ID not found')
    
    const { data: existingCategory } = await supabaseAdmin
      .from('store_categories')
      .select('id')
      .eq('region_id', regionId)
      .eq('name', category.name)
      .single()

    if (!existingCategory) {
      const { data: newCategory, error } = await supabaseAdmin
        .from('store_categories')
        .insert({
          region_id: regionId,
          name: category.name,
          description: category.description,
          is_active: true
        })
        .select()
        .single()

      if (error || !newCategory) throw error || new Error('Failed to create category')
      console.log(`✓ Created category: ${category.name}`)

      // Create stores for this category
      await createStoresForCategory(newCategory.id as string, category.name)
    }
  }
}

async function createStoresForCategory(categoryId: string, categoryName: string) {
  const stores: Record<string, Array<{
    name: string
    code: string
    address: string
    phone: string
    email: string
    location_lat: number
    location_lng: number
  }>> = {
    '강남구': [
      {
        name: 'NY베이글 강남역점',
        code: 'GANGNAM001',
        address: '서울시 강남구 테헤란로 123',
        phone: '02-1234-5678',
        email: 'gangnam@nybalges.com',
        location_lat: 37.498095,
        location_lng: 127.027610
      },
      {
        name: 'NY베이글 삼성점',
        code: 'SAMSUNG001',
        address: '서울시 강남구 삼성로 456',
        phone: '02-2345-6789',
        email: 'samsung@nybalges.com',
        location_lat: 37.511521,
        location_lng: 127.059295
      }
    ],
    '종로구': [
      {
        name: 'NY베이글 광화문점',
        code: 'GWANGHWA001',
        address: '서울시 종로구 세종대로 789',
        phone: '02-3456-7890',
        email: 'gwanghwamun@nybalges.com',
        location_lat: 37.571607,
        location_lng: 126.976889
      }
    ],
    '마포구': [
      {
        name: 'NY베이글 홍대점',
        code: 'HONGDAE001',
        address: '서울시 마포구 홍익로 321',
        phone: '02-4567-8901',
        email: 'hongdae@nybalges.com',
        location_lat: 37.556014,
        location_lng: 126.922797
      }
    ]
  }

  const storeList = stores[categoryName] || []
  
  for (const store of storeList) {
    const { data: existingStore } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('code', store.code)
      .single()

    if (!existingStore) {
      const { error } = await supabaseAdmin
        .from('stores')
        .insert({
          category_id: categoryId,
          ...store,
          qr_code_id: `QR_${store.code}_${Date.now()}`,
          qr_secret: generateSecret(),
          location_radius: 100,
          operating_hours: {
            mon: { open: '09:00', close: '22:00' },
            tue: { open: '09:00', close: '22:00' },
            wed: { open: '09:00', close: '22:00' },
            thu: { open: '09:00', close: '22:00' },
            fri: { open: '09:00', close: '22:00' },
            sat: { open: '10:00', close: '22:00' },
            sun: { open: '10:00', close: '21:00' }
          },
          is_active: true
        })

      if (error) throw error
      console.log(`✓ Created store: ${store.name}`)
    }
  }
}

async function createSampleEmployees() {
  console.log('Creating sample employees...')

  // Get the first store
  const { data: stores } = await supabaseAdmin
    .from('stores')
    .select('id, name')
    .limit(1)

  if (!stores || stores.length === 0) {
    console.log('No stores found, skipping employee creation')
    return
  }

  const storeId = stores[0].id
  const storeName = stores[0].name

  // Sample employees
  const employees = [
    {
      email: 'manager@nybalges.com',
      password: 'Manager123!',
      full_name: '김매니저',
      role: 'manager',
      phone: '010-1111-2222',
      employment_type: 'full_time',
      hourly_wage: 15000,
      department: '운영팀'
    },
    {
      email: 'employee1@nybalges.com',
      password: 'Employee123!',
      full_name: '이직원',
      role: 'employee',
      phone: '010-3333-4444',
      employment_type: 'full_time',
      hourly_wage: 12000,
      department: '제조팀'
    },
    {
      email: 'parttime1@nybalges.com',
      password: 'Parttime123!',
      full_name: '박알바',
      role: 'part_time',
      phone: '010-5555-6666',
      employment_type: 'part_time',
      hourly_wage: 10000,
      department: '홀서빙'
    }
  ]

  for (const emp of employees) {
    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', emp.email)
      .single()

    if (existingUser) {
      console.log(`Employee ${emp.email} already exists, skipping...`)
      continue
    }

    // Create auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: emp.email,
      password: emp.password,
      email_confirm: true,
      user_metadata: {
        full_name: emp.full_name,
        role: emp.role
      }
    })

    if (authError) {
      console.error(`Error creating ${emp.email}:`, authError)
      continue
    }

    // Create employee record
    const { error: empError } = await supabaseAdmin
      .from('employees')
      .insert({
        user_id: authUser.user.id,
        store_id: storeId,
        qr_code: `EMP_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        hourly_wage: emp.hourly_wage,
        employment_type: emp.employment_type,
        department: emp.department,
        hire_date: new Date().toISOString().split('T')[0],
        is_active: true
      })

    if (empError) {
      console.error(`Error creating employee record for ${emp.email}:`, empError)
      continue
    }

    console.log(`✓ Created employee: ${emp.full_name} (${emp.role}) at ${storeName}`)
  }
}

// CLI execution
if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}