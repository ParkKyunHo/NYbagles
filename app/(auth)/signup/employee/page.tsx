import { EmployeeSignupForm } from '@/components/auth/EmployeeSignupFormFixed'

export default function EmployeeSignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            직원 회원가입
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            베이글샵 직원으로 등록하세요
          </p>
        </div>
        
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <EmployeeSignupForm />
        </div>
      </div>
    </div>
  )
}