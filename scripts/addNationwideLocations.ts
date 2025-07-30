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

// Nationwide location data
const nationwideData = {
  // 수도권
  '서울특별시': {
    code: 'SEOUL',
    districts: [
      '강남구', '강동구', '강북구', '강서구', '관악구',
      '광진구', '구로구', '금천구', '노원구', '도봉구',
      '동대문구', '동작구', '마포구', '서대문구', '서초구',
      '성동구', '성북구', '송파구', '양천구', '영등포구',
      '용산구', '은평구', '종로구', '중구', '중랑구'
    ]
  },
  '인천광역시': {
    code: 'INCHEON',
    districts: [
      '강화군', '계양구', '남동구', '동구', '미추홀구',
      '부평구', '서구', '연수구', '옹진군', '중구'
    ]
  },
  '경기도': {
    code: 'GYEONGGI',
    districts: [
      '가평군', '고양시', '과천시', '광명시', '광주시',
      '구리시', '군포시', '김포시', '남양주시', '동두천시',
      '부천시', '성남시', '수원시', '시흥시', '안산시',
      '안성시', '안양시', '양주시', '양평군', '여주시',
      '연천군', '오산시', '용인시', '의왕시', '의정부시',
      '이천시', '파주시', '평택시', '포천시', '하남시', '화성시'
    ]
  },
  
  // 충청권
  '대전광역시': {
    code: 'DAEJEON',
    districts: ['대덕구', '동구', '서구', '유성구', '중구']
  },
  '세종특별자치시': {
    code: 'SEJONG',
    districts: ['세종시']
  },
  '충청북도': {
    code: 'CHUNGBUK',
    districts: [
      '괴산군', '단양군', '보은군', '영동군', '옥천군',
      '음성군', '제천시', '증평군', '진천군', '청주시', '충주시'
    ]
  },
  '충청남도': {
    code: 'CHUNGNAM',
    districts: [
      '계룡시', '공주시', '금산군', '논산시', '당진시',
      '보령시', '부여군', '서산시', '서천군', '아산시',
      '예산군', '천안시', '청양군', '태안군', '홍성군'
    ]
  },
  
  // 전라권
  '광주광역시': {
    code: 'GWANGJU',
    districts: ['광산구', '남구', '동구', '북구', '서구']
  },
  '전라북도': {
    code: 'JEONBUK',
    districts: [
      '고창군', '군산시', '김제시', '남원시', '무주군',
      '부안군', '순창군', '완주군', '익산시', '임실군',
      '장수군', '전주시', '정읍시', '진안군'
    ]
  },
  '전라남도': {
    code: 'JEONNAM',
    districts: [
      '강진군', '고흥군', '곡성군', '광양시', '구례군',
      '나주시', '담양군', '목포시', '무안군', '보성군',
      '순천시', '신안군', '여수시', '영광군', '영암군',
      '완도군', '장성군', '장흥군', '진도군', '함평군',
      '해남군', '화순군'
    ]
  },
  
  // 경상권
  '부산광역시': {
    code: 'BUSAN',
    districts: [
      '강서구', '금정구', '기장군', '남구', '동구',
      '동래구', '부산진구', '북구', '사상구', '사하구',
      '서구', '수영구', '연제구', '영도구', '중구', '해운대구'
    ]
  },
  '대구광역시': {
    code: 'DAEGU',
    districts: [
      '남구', '달서구', '달성군', '동구', '북구',
      '서구', '수성구', '중구'
    ]
  },
  '울산광역시': {
    code: 'ULSAN',
    districts: ['남구', '동구', '북구', '울주군', '중구']
  },
  '경상북도': {
    code: 'GYEONGBUK',
    districts: [
      '경산시', '경주시', '고령군', '구미시', '군위군',
      '김천시', '문경시', '봉화군', '상주시', '성주군',
      '안동시', '영덕군', '영양군', '영주시', '영천시',
      '예천군', '울릉군', '울진군', '의성군', '청도군',
      '청송군', '칠곡군', '포항시'
    ]
  },
  '경상남도': {
    code: 'GYEONGNAM',
    districts: [
      '거제시', '거창군', '고성군', '김해시', '남해군',
      '밀양시', '사천시', '산청군', '양산시', '의령군',
      '진주시', '창녕군', '창원시', '통영시', '하동군',
      '함안군', '함양군', '합천군'
    ]
  },
  
  // 강원/제주
  '강원도': {
    code: 'GANGWON',
    districts: [
      '강릉시', '고성군', '동해시', '삼척시', '속초시',
      '양구군', '양양군', '영월군', '원주시', '인제군',
      '정선군', '철원군', '춘천시', '태백시', '평창군',
      '홍천군', '화천군', '횡성군'
    ]
  },
  '제주특별자치도': {
    code: 'JEJU',
    districts: ['제주시', '서귀포시']
  }
}

async function addNationwideLocations() {
  console.log('🚀 Adding nationwide location data...')
  console.log(`📍 Total regions to add: ${Object.keys(nationwideData).length}`)

  try {
    let regionCount = 0
    let districtCount = 0
    let errorCount = 0

    // Process each region
    for (const [regionName, regionData] of Object.entries(nationwideData)) {
      console.log(`\n🏛️ Processing ${regionName}...`)

      // Check if region exists
      let region = await supabaseAdmin
        .from('regions')
        .select('*')
        .eq('code', regionData.code)
        .single()
        .then(({ data }) => data)

      if (!region) {
        // Create region
        const { data, error } = await supabaseAdmin
          .from('regions')
          .insert({
            name: regionName,
            code: regionData.code,
            is_active: true
          })
          .select()
          .single()

        if (error) {
          console.error(`   ❌ Error creating region ${regionName}:`, error.message)
          errorCount++
          continue
        }

        region = data
        regionCount++
        console.log(`   ✅ Created region: ${regionName}`)
      } else {
        console.log(`   ⚠️  Region ${regionName} already exists`)
      }

      // Add districts for this region
      if (region) {
        console.log(`   📍 Adding ${regionData.districts.length} districts...`)
        
        for (const districtName of regionData.districts) {
          // Check if district exists
          const { data: existing } = await supabaseAdmin
            .from('store_categories')
            .select('*')
            .eq('region_id', region.id)
            .eq('name', districtName)
            .single()

          if (!existing) {
            const { error } = await supabaseAdmin
              .from('store_categories')
              .insert({
                region_id: region.id,
                name: districtName,
                description: `${regionName} ${districtName} 지역 매장들`,
                is_active: true
              })

            if (error) {
              console.error(`      ❌ Error creating ${districtName}:`, error.message)
              errorCount++
            } else {
              districtCount++
              console.log(`      ✅ Created district: ${districtName}`)
            }
          } else {
            console.log(`      ⚠️  District ${districtName} already exists`)
          }
        }
      }
    }

    // Summary
    console.log('\n📊 Summary:')
    console.log(`   Total regions processed: ${Object.keys(nationwideData).length}`)
    console.log(`   New regions created: ${regionCount}`)
    console.log(`   New districts created: ${districtCount}`)
    console.log(`   Errors encountered: ${errorCount}`)
    
    // Calculate total districts
    const totalDistricts = Object.values(nationwideData).reduce(
      (sum, region) => sum + region.districts.length, 0
    )
    console.log(`   Total districts in data: ${totalDistricts}`)
    
    console.log('\n✅ Nationwide location data setup completed!')

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Run the script
addNationwideLocations()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })