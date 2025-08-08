import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('환경 변수가 설정되지 않았습니다.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function resetAdminPassword() {
  try {
    console.log('시스템 관리자 비밀번호 재설정 중...')
    
    // 시스템 관리자 계정 확인
    const { data: admin, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', 'admin@nylovebagel.com')
      .eq('role', 'super_admin')
      .single()
    
    if (fetchError || !admin) {
      console.error('시스템 관리자를 찾을 수 없습니다:', fetchError)
      return
    }
    
    console.log('시스템 관리자 발견:', admin.email)
    
    // 비밀번호 업데이트
    const newPassword = 'Admin123!@#'
    
    const { data, error } = await supabase.auth.admin.updateUserById(
      admin.id,
      { 
        password: newPassword,
        email_confirm: true
      }
    )
    
    if (error) {
      console.error('비밀번호 업데이트 실패:', error)
      return
    }
    
    console.log('✅ 비밀번호가 성공적으로 재설정되었습니다!')
    console.log('=====================================')
    console.log('시스템 관리자 로그인 정보:')
    console.log('이메일: admin@nylovebagel.com')
    console.log('비밀번호: Admin123!@#')
    console.log('=====================================')
    
  } catch (error) {
    console.error('오류 발생:', error)
  }
}

resetAdminPassword()