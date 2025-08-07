import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // 현재 사용자 가져오기
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Service Role Key를 사용하여 RLS를 우회하고 프로필 가져오기
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    if (profileError) {
      console.error('Error fetching profile:', profileError)
      return NextResponse.json({ role: 'employee' })
    }
    
    return NextResponse.json({ 
      role: profile?.role || 'employee',
      userId: user.id
    })
  } catch (error) {
    console.error('Error in user-role API:', error)
    return NextResponse.json({ role: 'employee' })
  }
}