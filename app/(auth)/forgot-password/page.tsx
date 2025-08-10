'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) {
        setError(error.message)
      } else {
        setSuccess(true)
      }
    } catch (err) {
      setError('비밀번호 재설정 이메일 발송 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-bagel-yellow-50 to-bagel-yellow-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <div className="text-center">
              <div className="mx-auto w-32 h-32 bg-bagel-yellow rounded-full flex items-center justify-center shadow-lg mb-4">
                <span className="text-bagel-black font-display text-3xl font-bold">NY</span>
              </div>
              <h2 className="text-3xl font-extrabold text-bagel-black">
                이메일을 확인해주세요
              </h2>
            </div>
            <p className="mt-4 text-center text-sm text-bagel-brown">
              비밀번호 재설정 링크를 {email}로 전송했습니다.
            </p>
            <p className="mt-2 text-center text-sm text-bagel-brown">
              이메일을 받지 못했다면 스팸 폴더를 확인해주세요.
            </p>
          </div>
          
          <div className="text-center">
            <Link href="/login" className="font-medium text-bagel-brown hover:text-bagel-yellow-700">
              로그인 페이지로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-bagel-yellow-50 to-bagel-yellow-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="text-center">
            <div className="mx-auto w-32 h-32 bg-bagel-yellow rounded-full flex items-center justify-center shadow-lg mb-4">
              <span className="text-bagel-black font-display text-3xl font-bold">NY</span>
            </div>
            <h2 className="text-3xl font-extrabold text-bagel-black">
              비밀번호 재설정
            </h2>
          </div>
          <p className="mt-2 text-center text-sm text-bagel-brown">
            가입하신 이메일 주소를 입력해주세요
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
          
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
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
              className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-bagel-yellow-500 focus:border-bagel-yellow-500 focus:z-10 sm:text-sm"
              placeholder="이메일 주소"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-bagel-black bg-bagel-yellow hover:bg-bagel-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-bagel-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '전송 중...' : '비밀번호 재설정 이메일 보내기'}
            </button>
          </div>

          <div className="text-center">
            <Link href="/login" className="font-medium text-bagel-brown hover:text-bagel-yellow-700">
              로그인 페이지로 돌아가기
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}