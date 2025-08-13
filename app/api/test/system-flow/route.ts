import { NextResponse } from 'next/server'
import { runSystemFlowTests } from '@/lib/tests/system-flow-test'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    // 인증 확인
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      )
    }
    
    // 관리자만 테스트 실행 가능
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다' },
        { status: 403 }
      )
    }
    
    // 테스트 실행
    console.log('🚀 시스템 플로우 테스트 시작...')
    const results = await runSystemFlowTests()
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results
    })
  } catch (error) {
    console.error('System flow test error:', error)
    return NextResponse.json(
      { 
        error: '테스트 실행 중 오류가 발생했습니다',
        details: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    )
  }
}