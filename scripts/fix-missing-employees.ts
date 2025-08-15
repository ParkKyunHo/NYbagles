/**
 * 직원 데이터 복구 스크립트
 * 승인되었지만 employees 테이블에 레코드가 없는 직원들을 복구합니다.
 * 
 * 실행 방법:
 * npm run tsx scripts/fix-missing-employees.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// 환경 변수 로드
dotenv.config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.')
  console.error('NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 확인하세요.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function fixMissingEmployees() {
  console.log('🔧 직원 데이터 복구 시작...\n')

  try {
    // 1. 승인된 가입 요청 중 employees 레코드가 없는 사용자 찾기
    console.log('1️⃣ 승인되었지만 employees 레코드가 없는 사용자 검색 중...')
    
    const { data: missingEmployees, error: searchError } = await supabase
      .from('profiles')
      .select(`
        id,
        email,
        full_name,
        role,
        store_id,
        employee_signup_requests!inner(
          status,
          approved_at
        )
      `)
      .in('role', ['employee', 'part_time', 'manager'])
      .eq('employee_signup_requests.status', 'approved')
      .is('employees.id', null)

    if (searchError) {
      console.error('❌ 검색 중 오류 발생:', searchError)
      return
    }

    // 직접 SQL 쿼리로 누락된 직원 찾기
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['employee', 'part_time', 'manager'])

    if (profileError) {
      console.error('❌ 프로필 조회 오류:', profileError)
      return
    }

    const { data: employees, error: employeeError } = await supabase
      .from('employees')
      .select('user_id')

    if (employeeError) {
      console.error('❌ 직원 조회 오류:', employeeError)
      return
    }

    const existingEmployeeIds = new Set(employees?.map(e => e.user_id) || [])
    const missingProfiles = profiles?.filter(p => !existingEmployeeIds.has(p.id)) || []

    console.log(`✅ ${missingProfiles.length}명의 누락된 직원 발견\n`)

    if (missingProfiles.length === 0) {
      console.log('🎉 모든 직원의 데이터가 정상입니다!')
      return
    }

    // 2. 누락된 직원 정보 출력
    console.log('📋 누락된 직원 목록:')
    missingProfiles.forEach(profile => {
      console.log(`  - ${profile.full_name || '이름 없음'} (${profile.email})`)
    })
    console.log('')

    // 3. employees 레코드 생성
    console.log('2️⃣ employees 레코드 생성 중...')
    
    let successCount = 0
    let failCount = 0

    for (const profile of missingProfiles) {
      const qrCode = `EMP-RECOVERY-${profile.id}-${Date.now()}-${Math.random().toString(36).substring(7)}`
      
      const { error: insertError } = await supabase
        .from('employees')
        .insert({
          user_id: profile.id,
          store_id: profile.store_id,
          qr_code: qrCode,
          hourly_wage: 10500, // 최저시급
          employment_type: profile.role === 'part_time' ? 'part_time' : 'full_time',
          department: '미지정',
          hire_date: new Date().toISOString().split('T')[0],
          is_active: true
        })

      if (insertError) {
        console.error(`❌ ${profile.full_name || profile.email} 복구 실패:`, insertError.message)
        failCount++
      } else {
        console.log(`✅ ${profile.full_name || profile.email} 복구 완료`)
        successCount++
      }
    }

    console.log('\n' + '='.repeat(50))
    console.log('📊 복구 결과:')
    console.log(`  ✅ 성공: ${successCount}명`)
    console.log(`  ❌ 실패: ${failCount}명`)
    console.log('='.repeat(50))

    // 4. 검증
    console.log('\n3️⃣ 복구 결과 검증 중...')
    
    const { data: verifyEmployees, error: verifyError } = await supabase
      .from('employees')
      .select('user_id')
      .like('qr_code', 'EMP-RECOVERY-%')

    if (verifyError) {
      console.error('❌ 검증 중 오류:', verifyError)
    } else {
      console.log(`✅ 총 ${verifyEmployees?.length || 0}개의 복구된 레코드 확인`)
    }

    console.log('\n🎉 직원 데이터 복구 완료!')

  } catch (error) {
    console.error('❌ 예상치 못한 오류 발생:', error)
  }
}

// 스크립트 실행
fixMissingEmployees()