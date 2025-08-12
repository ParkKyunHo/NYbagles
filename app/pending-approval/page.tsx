import { getCachedAuthUser } from '@/lib/auth/unified-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function PendingApprovalPage() {
  const user = await getCachedAuthUser()
  
  // 로그인하지 않은 사용자는 로그인 페이지로
  if (!user) {
    redirect('/login')
  }
  
  // 이미 승인된 사용자는 대시보드로
  if (user.isApproved) {
    redirect('/dashboard')
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
            승인 대기 중
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            관리자의 승인을 기다리고 있습니다
          </p>
        </div>
        
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="space-y-4">
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    가입 승인 대기
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>
                      회원가입이 완료되었습니다. 관리자의 승인 후 시스템을 이용하실 수 있습니다.
                    </p>
                    <p className="mt-2">
                      보통 24시간 이내에 승인이 완료됩니다.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="text-sm text-gray-600">
              <p className="font-medium mb-2">가입 정보:</p>
              <ul className="space-y-1">
                <li>이메일: {user.email}</li>
                <li>이름: {user.fullName || '미설정'}</li>
                <li>역할: {user.role === 'admin' ? '관리자' : 
                          user.role === 'manager' ? '매니저' : 
                          user.role === 'employee' ? '직원' :
                          user.role === 'part_time' ? '파트타임' : user.role}</li>
                {user.organizationName && (
                  <li>조직: {user.organizationName}</li>
                )}
              </ul>
            </div>
            
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600 mb-4">
                문의사항이 있으신가요?
              </p>
              <p className="text-sm text-gray-600">
                관리자에게 문의하시거나 잠시 후 다시 시도해주세요.
              </p>
            </div>
          </div>
          
          <div className="mt-6 flex flex-col space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-bagel-yellow"
            >
              새로고침
            </button>
            <Link
              href="/login"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-bagel-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-bagel-yellow"
            >
              로그아웃
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}