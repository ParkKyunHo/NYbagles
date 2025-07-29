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

export function EmployeeSignupForm({ onSuccess }: EmployeeSignupFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'form' | 'verify' | 'pending'>('form')
  const [requestId, setRequestId] = useState<string | null>(null)
  const [stores, setStores] = useState<Store[]>([])
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    store_id: ''
  })

  const [verificationCode, setVerificationCode] = useState('')

  useEffect(() => {
    fetchStores()
  }, [])

  const fetchStores = async () => {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (data && !error) {
      setStores(data)
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

      // 선택한 매장 정보 가져오기
      const selectedStore = stores.find(s => s.id === formData.store_id)
      if (!selectedStore) {
        throw new Error('유효하지 않은 매장입니다')
      }

      // 회원가입 요청 생성
      const { data: request, error: requestError } = await supabase
        .from('employee_signup_requests')
        .insert({
          email: formData.email,
          full_name: formData.full_name,
          phone: formData.phone,
          store_id: formData.store_id,
          store_code: selectedStore.code,
          verification_code: Math.random().toString(36).substring(2, 8).toUpperCase()
        })
        .select()
        .single()

      if (requestError) {
        if (requestError.code === '23505') {
          throw new Error('이미 가입 요청한 이메일입니다')
        }
        throw requestError
      }

      setRequestId(request.id)
      
      // 실제로는 이메일로 인증 코드를 전송해야 함
      console.log('인증 코드:', request.verification_code)
      alert(`테스트용 인증 코드: ${request.verification_code}`)
      
      setStep('verify')
    } catch (error) {
      console.error('회원가입 요청 실패:', error)
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
      // 인증 코드 확인
      const { data: request, error: verifyError } = await supabase
        .from('employee_signup_requests')
        .update({
          verified: true,
          verified_at: new Date().toISOString(),
          status: 'verified'
        })
        .eq('id', requestId)
        .eq('verification_code', verificationCode.toUpperCase())
        .select()
        .single()

      if (verifyError || !request) {
        throw new Error('잘못된 인증 코드입니다')
      }

      setStep('pending')
      onSuccess?.()
    } catch (error) {
      console.error('인증 실패:', error)
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
        <p className="text-gray-600 mb-4">
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
          비밀번호 <span className="text-red-500">*</span>
        </label>
        <input
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-bagel-yellow bg-white text-gray-900 placeholder-gray-500"
          placeholder="비밀번호 (최소 6자)"
          minLength={6}
          required
        />
        <p className="text-xs text-gray-500 mt-1">최소 6자 이상</p>
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
          근무할 매장 <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <select
            value={formData.store_id}
            onChange={(e) => setFormData({ ...formData, store_id: e.target.value })}
            className="w-full px-3 py-2 pl-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-bagel-yellow bg-white text-gray-900 appearance-none"
            required
          >
            <option value="">매장을 선택하세요</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name} ({store.code})
              </option>
            ))}
          </select>
          <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        </div>
        <p className="text-xs text-gray-500 mt-1">
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