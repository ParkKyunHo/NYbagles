'use client'

import Link from 'next/link'
import { Building2, Users, ArrowLeft } from 'lucide-react'

export default function SignupPage() {
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
            회원가입 유형을 선택하세요
          </p>
        </div>
        
        <div className="mt-6 sm:mt-8 space-y-3 sm:space-y-4">
          {/* 직원 회원가입 */}
          <Link
            href="/signup/employee"
            className="relative block w-full px-4 sm:px-6 py-3 sm:py-4 border-2 border-gray-300 rounded-lg hover:border-bagel-yellow-500 hover:shadow-md transition-all duration-200 group bg-white"
          >
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="h-6 w-6 sm:h-8 sm:w-8 text-gray-600 group-hover:text-bagel-yellow-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-base sm:text-lg font-medium text-gray-900">직원 회원가입</h3>
                <p className="mt-1 text-xs sm:text-sm text-gray-700">
                  매장 직원으로 가입하여 출퇴근 관리를 시작하세요
                </p>
              </div>
            </div>
          </Link>

          {/* 관리자 안내 */}
          <div className="relative block w-full px-4 sm:px-6 py-3 sm:py-4 border-2 border-gray-200 rounded-lg bg-bagel-cream">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Building2 className="h-6 w-6 sm:h-8 sm:w-8 text-gray-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-base sm:text-lg font-medium text-gray-700">관리자 계정</h3>
                <p className="mt-1 text-xs sm:text-sm text-gray-700">
                  관리자 계정은 기존 관리자가 직접 추가합니다.
                  매장 관리자에게 문의해주세요.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Link
            href="/login"
            className="flex items-center justify-center text-xs sm:text-sm text-gray-600 hover:text-bagel-brown transition-colors duration-200"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            로그인 페이지로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  )
}