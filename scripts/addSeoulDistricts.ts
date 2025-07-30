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

// Seoul districts (구) data
const seoulDistricts = [
  '강남구', '강동구', '강북구', '강서구', '관악구',
  '광진구', '구로구', '금천구', '노원구', '도봉구',
  '동대문구', '동작구', '마포구', '서대문구', '서초구',
  '성동구', '성북구', '송파구', '양천구', '영등포구',
  '용산구', '은평구', '종로구', '중구', '중랑구'
]

async function addSeoulDistricts() {
  console.log('🚀 Adding Seoul districts...')

  try {
    // Find Seoul region
    const { data: seoulRegion, error: regionError } = await supabaseAdmin
      .from('regions')
      .select('*')
      .eq('code', 'SEOUL')
      .single()

    if (regionError || !seoulRegion) {
      console.error('❌ Seoul region not found. Please run initializeTestData.ts first.')
      return
    }

    console.log(`✅ Found Seoul region: ${seoulRegion.name}`)

    // Add all Seoul districts
    console.log('\n📍 Adding districts...')
    let successCount = 0
    let existingCount = 0

    for (const districtName of seoulDistricts) {
      // Check if district already exists
      const { data: existing } = await supabaseAdmin
        .from('store_categories')
        .select('*')
        .eq('region_id', seoulRegion.id)
        .eq('name', districtName)
        .single()

      if (existing) {
        console.log(`   ⚠️  ${districtName} already exists`)
        existingCount++
      } else {
        const { data, error } = await supabaseAdmin
          .from('store_categories')
          .insert({
            region_id: seoulRegion.id,
            name: districtName,
            description: `서울 ${districtName} 지역 매장들`,
            is_active: true
          })
          .select()
          .single()

        if (error) {
          console.error(`   ❌ Error creating ${districtName}:`, error.message)
        } else {
          console.log(`   ✅ Created district: ${districtName}`)
          successCount++
        }
      }
    }

    console.log('\n📊 Summary:')
    console.log(`   Total districts: ${seoulDistricts.length}`)
    console.log(`   Newly created: ${successCount}`)
    console.log(`   Already existing: ${existingCount}`)
    console.log('\n✅ Seoul districts setup completed!')

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Run the script
addSeoulDistricts()