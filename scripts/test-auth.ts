import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zkvvgohssysenjiitevc.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprdnZnb2hzc3lzZW5qaWl0ZXZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5NDIwNjUsImV4cCI6MjA2ODUxODA2NX0.fqiPN8JYvOTmdIB9N24_qzbm81OiG3mU_AY23PAEH0o'

async function testAuth() {
  console.log('🔍 Testing Supabase Authentication...\n')
  
  console.log('1. Environment Variables:')
  console.log('   - Supabase URL:', supabaseUrl)
  console.log('   - Has Anon Key:', !!supabaseAnonKey)
  console.log('')
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  
  console.log('2. Testing Login with admin@nylovebagel.com:')
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'admin@nylovebagel.com',
      password: 'admin123456'
    })
    
    if (error) {
      console.error('   ❌ Login failed:', error.message)
      console.error('   Error details:', error)
    } else {
      console.log('   ✅ Login successful!')
      console.log('   - User ID:', data.user?.id)
      console.log('   - Email:', data.user?.email)
      console.log('   - Role:', data.user?.role)
      console.log('   - Session:', !!data.session)
      
      // 프로필 정보 가져오기
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user?.id)
        .single()
      
      if (profile) {
        console.log('   - Profile Role:', profile.role)
      }
      
      // 로그아웃
      await supabase.auth.signOut()
      console.log('   ✅ Logout successful')
    }
  } catch (err) {
    console.error('   ❌ Unexpected error:', err)
  }
  
  console.log('\n3. Testing API Key Headers:')
  
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/profiles?select=id&limit=1`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    })
    
    if (response.ok) {
      console.log('   ✅ API Key is working')
    } else {
      console.error('   ❌ API Key issue:', response.status, response.statusText)
      const text = await response.text()
      console.error('   Response:', text)
    }
  } catch (err) {
    console.error('   ❌ Request failed:', err)
  }
  
  console.log('\n✨ Test completed!')
}

testAuth().catch(console.error)