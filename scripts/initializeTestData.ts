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

async function initializeTestData() {
  console.log('🚀 Initializing test data...')
  console.log('   URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)

  try {
    // 1. Create regions
    console.log('\n1️⃣ Creating regions...')
    const regions = [
      { name: '서울', code: 'SEOUL', is_active: true },
      { name: '경기', code: 'GYEONGGI', is_active: true },
      { name: '부산', code: 'BUSAN', is_active: true }
    ]

    const createdRegions = []
    for (const region of regions) {
      const { data: existing } = await supabaseAdmin
        .from('regions')
        .select('*')
        .eq('code', region.code)
        .single()

      if (existing) {
        console.log(`   ⚠️  Region ${region.name} already exists`)
        createdRegions.push(existing)
      } else {
        const { data, error } = await supabaseAdmin
          .from('regions')
          .insert(region)
          .select()
          .single()

        if (error) {
          console.error(`   ❌ Error creating region ${region.name}:`, error.message)
        } else {
          console.log(`   ✅ Created region: ${region.name}`)
          createdRegions.push(data)
        }
      }
    }

    // 2. Create categories for Seoul
    const seoulRegion = createdRegions.find(r => r.code === 'SEOUL')
    if (seoulRegion) {
      console.log('\n2️⃣ Creating categories for Seoul...')
      const categories = [
        { name: '강남구', description: '서울 강남구 지역 매장들' },
        { name: '종로구', description: '서울 종로구 지역 매장들' },
        { name: '마포구', description: '서울 마포구 지역 매장들' }
      ]

      const createdCategories = []
      for (const category of categories) {
        const { data: existing } = await supabaseAdmin
          .from('store_categories')
          .select('*')
          .eq('region_id', seoulRegion.id)
          .eq('name', category.name)
          .single()

        if (existing) {
          console.log(`   ⚠️  Category ${category.name} already exists`)
          createdCategories.push(existing)
        } else {
          const { data, error } = await supabaseAdmin
            .from('store_categories')
            .insert({
              region_id: seoulRegion.id,
              ...category,
              is_active: true
            })
            .select()
            .single()

          if (error) {
            console.error(`   ❌ Error creating category ${category.name}:`, error.message)
          } else {
            console.log(`   ✅ Created category: ${category.name}`)
            createdCategories.push(data)
          }
        }
      }

      // 3. Create stores
      console.log('\n3️⃣ Creating stores...')
      const gangnamCategory = createdCategories.find(c => c.name === '강남구')
      if (gangnamCategory) {
        const stores = [
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
        ]

        for (const store of stores) {
          const { data: existing } = await supabaseAdmin
            .from('stores')
            .select('*')
            .eq('code', store.code)
            .single()

          if (existing) {
            console.log(`   ⚠️  Store ${store.name} already exists`)
            console.log(`      📍 QR Code ID: ${existing.qr_code_id}`)
          } else {
            const { data, error } = await supabaseAdmin
              .from('stores')
              .insert({
                category_id: gangnamCategory.id,
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
              .select()
              .single()

            if (error) {
              console.error(`   ❌ Error creating store ${store.name}:`, error.message)
            } else {
              console.log(`   ✅ Created store: ${store.name}`)
              console.log(`      📍 QR Code ID: ${data.qr_code_id}`)
            }
          }
        }
      }
    }

    console.log('\n✅ Test data initialization completed!')
    console.log('\n📝 Next Steps:')
    console.log('   1. Create a super_admin account through Supabase Dashboard')
    console.log('   2. Or use the SQL script in /supabase/seed/01_initial_admin.sql')
    console.log('\n   Test Account (to be created):')
    console.log('   Email: admin@nylovebagel.com')
    console.log('   Password: Admin123!@#')
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

initializeTestData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })