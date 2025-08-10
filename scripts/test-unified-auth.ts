import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zkvvgohssysenjiitevc.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprdnZnb2hzc3lzZW5qaWl0ZXZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5NDIwNjUsImV4cCI6MjA2ODUxODA2NX0.fqiPN8JYvOTmdIB9N24_qzbm81OiG3mU_AY23PAEH0o'

async function testUnifiedAuth() {
  console.log('🔍 통합 인증 시스템 테스트 시작...\n')
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  
  console.log('1. 로그인 시도 (admin@nylovebagel.com)...')
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'admin@nylovebagel.com',
      password: 'admin123456'
    })
    
    if (error) {
      console.error('   ❌ 로그인 실패:', error.message)
      return
    }
    
    console.log('   ✅ 로그인 성공!')
    console.log('   - User ID:', data.user?.id)
    console.log('   - Email:', data.user?.email)
    
    // 세션 확인
    const { data: sessionData } = await supabase.auth.getSession()
    console.log('   - Session:', !!sessionData?.session)
    
    console.log('\n2. 사용자 프로필 정보 확인...')
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user?.id)
      .single()
    
    if (profile) {
      console.log('   ✅ 프로필 정보:')
      console.log('   - Role:', profile.role)
      console.log('   - Full Name:', profile.full_name)
    }
    
    console.log('\n3. 직원 정보 확인...')
    const { data: employee } = await supabase
      .from('employees')
      .select(`
        id,
        user_id,
        store_id,
        position,
        is_active,
        stores (
          id,
          name,
          is_active
        )
      `)
      .eq('user_id', data.user?.id)
      .single()
    
    if (employee) {
      console.log('   ✅ 직원 정보:')
      console.log('   - Employee ID:', employee.id)
      console.log('   - Store ID:', employee.store_id)
      console.log('   - Store Name:', (employee as any)?.stores?.name)
      console.log('   - Position:', employee.position || '미설정')
      console.log('   - Is Active:', employee.is_active)
      console.log('   - Store Active:', (employee as any)?.stores?.is_active)
    }
    
    console.log('\n4. 대시보드 접근 권한 테스트...')
    const dashboards = [
      '/dashboard',
      '/dashboard/employees',
      '/dashboard/quick-sale',
      '/dashboard/analytics',
      '/sales/summary',
      '/products',
      '/admin/stores'
    ]
    
    console.log('   권한 체크 (role: ' + profile?.role + '):')
    dashboards.forEach(path => {
      // 간단한 권한 체크 시뮬레이션
      const canAccess = 
        profile?.role === 'super_admin' || 
        (profile?.role === 'admin' && !path.includes('/admin/stores')) ||
        (profile?.role === 'manager' && !path.includes('/admin'))
      
      console.log(`   ${canAccess ? '✅' : '❌'} ${path}`)
    })
    
    console.log('\n5. 로그아웃...')
    await supabase.auth.signOut()
    console.log('   ✅ 로그아웃 완료')
    
    console.log('\n✨ 통합 인증 시스템 테스트 완료!')
    console.log('모든 대시보드가 정상적으로 작동해야 합니다.')
    
  } catch (err) {
    console.error('❌ 예상치 못한 오류:', err)
  }
}

testUnifiedAuth().catch(console.error)