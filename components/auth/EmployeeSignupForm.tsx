'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/supabase'
import { Button } from '@/components/ui/button'
import { Building2 } from 'lucide-react'

interface EmployeeSignupFormProps {
  onSuccess?: () => void
}

type Store = Database['public']['Tables']['stores']['Row']
type StoreCategory = Database['public']['Tables']['store_categories']['Row']
type Region = Database['public']['Tables']['regions']['Row']

interface StoreWithRelations extends Store {
  store_categories?: StoreCategory & {
    regions?: Region
  }
}

export function EmployeeSignupForm({ onSuccess }: EmployeeSignupFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'form' | 'verify' | 'pending'>('form')
  const [requestId, setRequestId] = useState<string | null>(null)
  const [stores, setStores] = useState<StoreWithRelations[]>([])
  const [loadingStores, setLoadingStores] = useState(false)
  
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    phone: '',
    store_id: '',
    password: '',
    confirmPassword: ''
  })

  const [verificationCode, setVerificationCode] = useState('')

  useEffect(() => {
    fetchStores()
  }, [])

  const fetchStores = async () => {
    setLoadingStores(true)
    try {
      const { data, error } = await supabase
        .from('stores')
        .select(`
          *,
          store_categories (
            *,
            regions (*)
          )
        `)
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      
      if (data) {
        setStores(data)
      }
    } catch (error) {
      // Error handled silently
      setError('매장 목록을 불러오는 데 실패했습니다.')
    } finally {
      setLoadingStores(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (!formData.store_id) {
        throw new Error('매장을 선택해주세요')
      }

      // 비밀번호 확인
      if (formData.password !== formData.confirmPassword) {
        throw new Error('비밀번호가 일치하지 않습니다')
      }

      if (formData.password.length < 8) {
        throw new Error('비밀번호는 8자 이상이어야 합니다')
      }

      // 선택한 매장 정보 가져오기
      const selectedStore = stores.find(s => s.id === formData.store_id)
      if (!selectedStore) {
        throw new Error('유효하지 않은 매장입니다')
      }

      // API 엔드포인트 호출 방식으로 변경
      const response = await fetch('/api/auth/signup/employee', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          fullName: formData.full_name,
          phone: formData.phone,
          storeId: formData.store_id, // store_id를 직접 전송
          storeCode: selectedStore.code, // 혹시 code가 있으면 같이 전송
          password: formData.password // 비밀번호 추가
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '회원가입 요청에 실패했습니다')
      }

      setRequestId(result.requestId)
      
      // 이메일 인증 절차 생략 - 바로 pending 상태로
      setStep('pending')
    } catch (error) {
      // Error handled silently
      setError(error instanceof Error ? error.message : '회원가입 요청에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // API 엔드포인트를 통한 인증 확인
      const response = await fetch('/api/auth/signup/employee/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId,
          verificationCode: verificationCode.toUpperCase(),
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '인증에 실패했습니다')
      }

      setStep('pending')
      onSuccess?.()
    } catch (error) {
      // Error handled silently
      setError(error instanceof Error ? error.message : '인증에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'pending') {
    return (
      <div className="text-center p-8">
        <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold mb-2">회원가입 요청 완료</h3>
        <p className="text-gray-700 mb-4">
          관리자가 승인하면 이메일로 알려드리겠습니다.
        </p>
        <Button onClick={() => router.push('/login')} variant="outline">
          로그인 페이지로
        </Button>
      </div>
    )
  }

  if (step === 'verify') {
    return (
      <form onSubmit={handleVerification} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">
            인증 코드
          </label>
          <input
            type="text"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-bagel-yellow bg-white text-gray-900 placeholder-gray-500"
            placeholder="이메일로 받은 인증 코드 입력"
            required
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep('form')}
            disabled={loading}
            className="flex-1"
          >
            이전
          </Button>
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? '확인 중...' : '인증 확인'}
          </Button>
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2 text-gray-700">
          이메일 <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-bagel-yellow bg-white text-gray-900 placeholder-gray-500"
          placeholder="이메일 주소"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2 text-gray-700">
          이름 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.full_name}
          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-bagel-yellow bg-white text-gray-900 placeholder-gray-500"
          placeholder="실명을 입력해주세요"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2 text-gray-700">
          전화번호
        </label>
        <input
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-bagel-yellow bg-white text-gray-900 placeholder-gray-500"
          placeholder="010-0000-0000"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2 text-gray-700">
          비밀번호 <span className="text-red-500">*</span>
        </label>
        <input
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-bagel-yellow bg-white text-gray-900 placeholder-gray-500"
          placeholder="비밀번호 (8자 이상)"
          minLength={8}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2 text-gray-700">
          비밀번호 확인 <span className="text-red-500">*</span>
        </label>
        <input
          type="password"
          value={formData.confirmPassword}
          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-bagel-yellow bg-white text-gray-900 placeholder-gray-500"
          placeholder="비밀번호 확인"
          minLength={8}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2 text-gray-700">
          근무할 매장 <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <select
            value={formData.store_id}
            onChange={(e) => setFormData({ ...formData, store_id: e.target.value })}
            className="w-full px-3 py-2 pl-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-bagel-yellow bg-white text-gray-900 appearance-none"
            required
            disabled={loadingStores}
          >
            <option value="">
              {loadingStores ? '매장 목록 로딩 중...' : '매장을 선택하세요'}
            </option>
            {/* Group stores by region for better organization */}
            {(() => {
              // Group stores by region
              const storesByRegion = stores.reduce((acc, store) => {
                const regionName = store.store_categories?.regions?.name || '기타'
                if (!acc[regionName]) {
                  acc[regionName] = []
                }
                acc[regionName].push(store)
                return acc
              }, {} as Record<string, typeof stores>)

              // Sort region names
              const sortedRegions = Object.keys(storesByRegion).sort()

              return sortedRegions.map(regionName => (
                <optgroup key={regionName} label={regionName}>
                  {storesByRegion[regionName].map(store => {
                    const categoryName = store.store_categories?.name || ''
                    const locationDisplay = categoryName ? ` - ${categoryName}` : ''
                    
                    return (
                      <option key={store.id} value={store.id}>
                        {store.name}{locationDisplay}
                      </option>
                    )
                  })}
                </optgroup>
              ))
            })()}
          </select>
          <Building2 className="h-4 w-4 mr-2 text-gray-700"" />
        </div>
        <p className="text-xs text-gray-700 mt-1">
          근무하실 매장을 선택해주세요
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
          {error}
        </div>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? '처리 중...' : '회원가입 요청'}
      </Button>

      <p className="text-center text-sm text-gray-600">
        이미 계정이 있으신가요?{' '}
        <a href="/login" className="text-blue-600 hover:underline">
          로그인
        </a>
      </p>
    </form>
  )
}