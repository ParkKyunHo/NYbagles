import { getCachedAuthUser } from '@/lib/auth/unified-auth'
import { createAdminClient } from '@/lib/supabase/server-admin'
import { redirect } from 'next/navigation'
import SelectOrganizationClient from './SelectOrganizationClient'
import { serializeRows } from '@/lib/utils/serialization'

export default async function SelectOrganizationPage() {
  const user = await getCachedAuthUser()
  
  // 로그인하지 않은 사용자는 로그인 페이지로
  if (!user) {
    redirect('/login')
  }
  
  // 이미 조직이 설정된 사용자는 대시보드로
  if (user.organizationId) {
    redirect('/dashboard')
  }
  
  // 승인되지 않은 사용자는 승인 대기 페이지로
  if (!user.isApproved) {
    redirect('/pending-approval')
  }
  
  // 사용자가 속한 조직 목록 가져오기
  const adminClient = createAdminClient()
  const { data: memberships, error } = await adminClient
    .from('memberships')
    .select(`
      org_id,
      role,
      approved_at,
      organizations (
        id,
        name,
        legacy_store_id
      )
    `)
    .eq('user_id', user.id)
    .not('approved_at', 'is', null)
  
  if (error) {
    console.error('[SelectOrganization] Error fetching memberships:', error)
  }
  
  // 승인된 조직이 없는 경우
  if (!memberships || memberships.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto w-24 h-24 bg-bagel-yellow rounded-full flex items-center justify-center">
              <div className="w-16 h-16 bg-bagel-black rounded-full flex items-center justify-center">
                <span className="text-bagel-yellow font-display text-2xl font-bold">NY</span>
              </div>
            </div>
            <h2 className="mt-6 text-3xl font-bold text-gray-900">
              조직이 없습니다
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              가입 가능한 조직이 없습니다. 관리자에게 문의하세요.
            </p>
          </div>
        </div>
      </div>
    )
  }
  
  // 조직이 하나만 있는 경우 자동 선택
  if (memberships.length === 1) {
    const singleOrg = (memberships[0] as any).organizations
    
    // user_settings 업데이트
    await adminClient
      .from('user_settings')
      .upsert({
        user_id: user.id,
        active_org_id: singleOrg.id,
        updated_at: new Date().toISOString()
      })
      .select()
      .single()
    
    redirect('/dashboard')
  }
  
  // 직렬화된 조직 목록
  const serializedOrganizations = serializeRows(
    memberships.map(m => ({
      ...(m as any).organizations,
      role: m.role
    }))
  )
  
  return <SelectOrganizationClient organizations={serializedOrganizations} userId={user.id} />
}