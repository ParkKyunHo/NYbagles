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

async function createTestData() {
  console.log('🚀 Creating test data...')

  try {
    // 1. Create test user with Supabase Auth
    console.log('\n1️⃣ Creating test admin user...')
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: 'test@nylovebagel.com',
      password: 'Test123!@#',
      email_confirm: true
    })

    if (authError) {
      if (authError.message?.includes('already been registered')) {
        console.log('   ⚠️  User already exists, skipping...')
      } else {
        console.error('   ❌ Error creating user:', authError.message)
        return
      }
    } else {
      console.log('   ✅ Auth user created successfully')
      
      // Update profile to super_admin
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ 
          role: 'super_admin',
          full_name: 'Test Administrator'
        })
        .eq('id', authUser.user.id)

      if (profileError) {
        console.error('   ❌ Error updating profile:', profileError.message)
      } else {
        console.log('   ✅ Profile updated to super_admin')
      }
    }

    // 2. Create test region
    console.log('\n2️⃣ Creating test region...')
    let regionId: string | null = null
    
    const { data: existingRegion } = await supabaseAdmin
      .from('regions')
      .select('id')
      .eq('code', 'SEOUL')
      .single()

    if (existingRegion) {
      regionId = existingRegion.id
      console.log('   ⚠️  Seoul region already exists')
    } else {
      const { data: newRegion, error: regionError } = await supabaseAdmin
        .from('regions')
        .insert({
          name: '서울',
          code: 'SEOUL',
          is_active: true
        })
        .select()
        .single()

      if (regionError) {
        console.error('   ❌ Error creating region:', regionError.message)
        return
      } else {
        regionId = newRegion.id
        console.log('   ✅ Seoul region created')
      }
    }

    // 3. Create test category
    console.log('\n3️⃣ Creating test category...')
    let categoryId: string | null = null

    const { data: existingCategory } = await supabaseAdmin
      .from('store_categories')
      .select('id')
      .eq('name', '강남구')
      .eq('region_id', regionId)
      .single()

    if (existingCategory) {
      categoryId = existingCategory.id
      console.log('   ⚠️  강남구 category already exists')
    } else {
      const { data: newCategory, error: categoryError } = await supabaseAdmin
        .from('store_categories')
        .insert({
          region_id: regionId,
          name: '강남구',
          description: '서울 강남구 지역 매장들',
          is_active: true
        })
        .select()
        .single()

      if (categoryError) {
        console.error('   ❌ Error creating category:', categoryError.message)
        return
      } else {
        categoryId = newCategory.id
        console.log('   ✅ 강남구 category created')
      }
    }

    // 4. Create test store
    console.log('\n4️⃣ Creating test store...')
    
    const { data: existingStore } = await supabaseAdmin
      .from('stores')
      .select('id, name, qr_code_id')
      .eq('code', 'GANGNAM001')
      .single()

    if (existingStore) {
      console.log('   ⚠️  강남역점 already exists')
      console.log(`   📍 Store: ${existingStore.name}`)
      console.log(`   🔗 QR Code ID: ${existingStore.qr_code_id}`)
    } else {
      const qrCodeId = `QR_GANGNAM001_${Date.now()}`
      const { data: newStore, error: storeError } = await supabaseAdmin
        .from('stores')
        .insert({
          category_id: categoryId,
          name: '뉴욕러브베이글 강남역점',
          code: 'GANGNAM001',
          address: '서울시 강남구 테헤란로 123',
          phone: '02-1234-5678',
          email: 'gangnam@nylovebagel.com',
          qr_code_id: qrCodeId,
          qr_secret: generateSecret(),
          location_lat: 37.498095,
          location_lng: 127.027610,
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
        .select()
        .single()

      if (storeError) {
        console.error('   ❌ Error creating store:', storeError.message)
      } else {
        console.log('   ✅ Store created successfully')
        console.log(`   📍 Store: ${newStore.name}`)
        console.log(`   🔗 QR Code ID: ${newStore.qr_code_id}`)
      }
    }

    console.log('\n✅ Test data creation completed!')
    console.log('\n📝 Test Account Information:')
    console.log('   Email: test@nylovebagel.com')
    console.log('   Password: Test123!@#')
    console.log('   Role: super_admin')

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

function generateSecret(): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 32; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length))
  }
  return result
}

createTestData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })