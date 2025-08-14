'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string>('')

  useEffect(() => {
    // 환경변수 확인
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!url || !key) {
      setError('Supabase 환경변수가 설정되지 않았습니다.')
      setDebugInfo(`URL: ${url ? '설정됨' : '누락'}, Key: ${key ? '설정됨' : '누락'}`)
    } else {
      setDebugInfo(`URL: ${url.substring(0, 30)}..., Key: ${key.substring(0, 20)}...`)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      
      console.log('로그인 시도:', email)
      
      // 로그인 시도
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password,
      })

      if (signInError) {
        console.error('로그인 오류:', signInError)
        
        // 에러 메시지를 더 구체적으로 처리
        if (signInError.message.includes('Invalid login credentials')) {
          setError('이메일 또는 비밀번호가 올바르지 않습니다.')
          setDebugInfo(`입력한 이메일: ${email}`)
        } else if (signInError.message.includes('Email not confirmed')) {
          setError('이메일 인증이 완료되지 않았습니다. 이메일을 확인해주세요.')
        } else if (signInError.message.includes('Too many requests')) {
          setError('너무 많은 로그인 시도가 있었습니다. 잠시 후 다시 시도해주세요.')
        } else {
          setError(signInError.message)
        }
        return
      }

      if (data?.user) {
        console.log('로그인 성공:', data.user.email)
        
        // 세션 확인
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('세션 오류:', sessionError)
          setError('세션 생성에 실패했습니다.')
          return
        }
        
        if (!sessionData?.session) {
          console.error('세션이 없습니다')
          setError('세션이 생성되지 않았습니다.')
          return
        }
        
        console.log('세션 확인 완료:', sessionData.session.user.email)
        
        // 대시보드로 리다이렉트
        window.location.href = '/dashboard'
      } else {
        setError('로그인에 실패했습니다.')
      }
    } catch (err) {
      console.error('예상치 못한 오류:', err)
      setError('로그인 중 오류가 발생했습니다.')
      setDebugInfo(err instanceof Error ? err.message : '알 수 없는 오류')
    } finally {
      setLoading(false)
    }
  }

  // 테스트 로그인 함수
  const handleTestLogin = () => {
    setEmail('admin@nylovebagel.com')
    setPassword('admin123456')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-bagel-yellow-50 to-bagel-yellow-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 sm:space-y-8">
        <div>
          <div className="text-center">
            <div className="mx-auto w-24 h-24 sm:w-32 sm:h-32 bg-bagel-yellow rounded-full flex items-center justify-center shadow-lg mb-4">
              <span className="text-bagel-black font-display text-2xl sm:text-3xl font-bold">NY</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-bagel-black">
              뉴욕러브 베이글
            </h2>
          </div>
          <p className="mt-2 text-center text-sm text-bagel-brown">
            직원 관리 시스템
          </p>
        </div>
        
        <form className="mt-6 sm:mt-8 space-y-4 sm:space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-red-800">{error}</p>
              {debugInfo && (
                <p className="text-xs text-red-600 mt-1">디버그: {debugInfo}</p>
              )}
            </div>
          )}
          
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                이메일 주소
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 sm:py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow-500 focus:border-bagel-yellow-500 focus:z-10 text-sm sm:text-base"
                placeholder="이메일 주소"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                비밀번호
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 sm:py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow-500 focus:border-bagel-yellow-500 focus:z-10 text-sm sm:text-base"
                placeholder="비밀번호"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-bagel-yellow-600 focus:ring-bagel-yellow-500 border-gray-300 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-xs sm:text-sm text-gray-900">
                로그인 상태 유지
              </label>
            </div>

            <div className="text-xs sm:text-sm">
              <Link href="/forgot-password" className="font-medium text-bagel-brown hover:text-bagel-yellow-700">
                비밀번호를 잊으셨나요?
              </Link>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm sm:text-base font-medium rounded-md text-bagel-black bg-bagel-yellow hover:bg-bagel-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-bagel-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </div>

          {/* 개발 환경에서만 표시되는 테스트 버튼 */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4">
              <button
                type="button"
                onClick={handleTestLogin}
                className="w-full text-xs text-gray-800 hover:text-gray-900"
              >
                테스트 계정으로 자동 입력 (admin@nylovebagel.com)
              </button>
            </div>
          )}

          <div className="text-center">
            <span className="text-xs sm:text-sm text-gray-700">
              계정이 없으신가요?{' '}
              <Link href="/signup" className="font-medium text-bagel-brown hover:text-bagel-yellow-700">
                회원가입
              </Link>
            </span>
          </div>
        </form>
      </div>
    </div>
  )
}