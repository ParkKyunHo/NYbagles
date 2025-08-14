'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Organization {
  id: string
  name: string
  legacy_store_id?: string
  role: string
}

interface Props {
  organizations: Organization[]
  userId: string
}

export default function SelectOrganizationClient({ organizations, userId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()
  
  const handleSelectOrganization = async (orgId: string) => {
    setLoading(true)
    setError(null)
    
    try {
      // user_settings 업데이트
      const { error: updateError } = await supabase
        .from('user_settings')
        .upsert({
          user_id: userId,
          active_org_id: orgId,
          updated_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (updateError) {
        throw updateError
      }
      
      // 페이지 새로고침하여 인증 정보 갱신
      window.location.href = '/dashboard'
    } catch (err) {
      console.error('[SelectOrganization] Error:', err)
      setError('조직 선택 중 오류가 발생했습니다. 다시 시도해주세요.')
      setLoading(false)
    }
  }
  
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
            조직 선택
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            작업할 조직을 선택해주세요
          </p>
        </div>
        
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
              {error}
            </div>
          )}
          
          <div className="space-y-3">
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => handleSelectOrganization(org.id)}
                disabled={loading}
                className="w-full text-left px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-bagel-yellow disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-900">{org.name}</p>
                    <p className="text-sm text-gray-700">
                      역할: {
                        org.role === 'admin' ? '관리자' :
                        org.role === 'manager' ? '매니저' :
                        org.role === 'employee' ? '직원' :
                        org.role === 'part_time' ? '파트타임' : org.role
                      }
                    </p>
                  </div>
                  <svg className="h-5 w-5 text-gray-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
          
          {loading && (
            <div className="mt-4 text-center">
              <div className="inline-flex items-center">
                <svg className="animate-spin h-5 w-5 mr-3 text-bagel-yellow" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-gray-600">조직 설정 중...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}