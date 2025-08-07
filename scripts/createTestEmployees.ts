import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zkvvgohssysenjiitevc.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprdnZnb2hzc3lzZW5qaWl0ZXZjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mjk0MjA2NSwiZXhwIjoyMDY4NTE4MDY1fQ.CQld8jjASSZUJL9jP9JMdKroBG33pfkE7nz2JeEAgco'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createTestEmployees() {
  const testUsers = [
    { email: 'manager1@test.com', password: 'Test1234!', name: '박매니저', role: 'manager', store_id: '629e96ad-fbec-4e3a-80bd-a009d06f1502' },
    { email: 'emp1@test.com', password: 'Test1234!', name: '이직원', role: 'employee', store_id: '629e96ad-fbec-4e3a-80bd-a009d06f1502' },
    { email: 'part1@test.com', password: 'Test1234!', name: '최파트', role: 'part_time', store_id: '112ceffc-ffe3-4d55-83a6-63a684f3efda' }
  ]

  for (const userData of testUsers) {
    try {
      // 1. Create auth user
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: {
          full_name: userData.name
        }
      })

      if (authError) {
        console.error(`Error creating auth user ${userData.email}:`, authError)
        continue
      }

      console.log(`Created auth user: ${userData.email}`)

      // 2. Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: userData.name,
          role: userData.role,
          store_id: userData.store_id
        })
        .eq('id', authUser.user.id)

      if (profileError) {
        console.error(`Error updating profile for ${userData.email}:`, profileError)
        continue
      }

      console.log(`Updated profile for: ${userData.email}`)

      // 3. Create employee record
      const employeeNumber = `EMP${Date.now().toString().slice(-6)}${Math.random().toString(36).substr(2, 3).toUpperCase()}`
      const qrCode = `${userData.store_id}-${employeeNumber}`

      const { error: employeeError } = await supabase
        .from('employees')
        .insert({
          user_id: authUser.user.id,
          store_id: userData.store_id,
          employee_number: employeeNumber,
          qr_code: qrCode,
          hourly_wage: userData.role === 'manager' ? 15000 : 9860,
          hire_date: new Date().toISOString().split('T')[0],
          is_active: true
        })

      if (employeeError) {
        console.error(`Error creating employee record for ${userData.email}:`, employeeError)
      } else {
        console.log(`Created employee record for: ${userData.email}`)
      }

    } catch (error) {
      console.error(`Unexpected error for ${userData.email}:`, error)
    }
  }

  console.log('\n✅ Test employees created successfully!')
  console.log('Login credentials:')
  testUsers.forEach(u => {
    console.log(`- ${u.email} / ${u.password} (${u.role})`)
  })
}

createTestEmployees()