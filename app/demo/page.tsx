'use client'

import { EmployeeSignupForm } from '@/components/auth/EmployeeSignupForm'
import { StoreQRDisplay } from '@/components/qr/StoreQRDisplay'
import { QRScanner } from '@/components/qr/QRScanner'

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-12">
          베이글샵 통합 관리 시스템 - QR 로그인 데모
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 직원 회원가입 */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold mb-6">1. 직원 회원가입</h2>
            <EmployeeSignupForm />
          </div>

          {/* 매장 QR 코드 */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold mb-6">2. 매장 QR 코드</h2>
            <p className="text-sm text-gray-700 mb-4">
              매장에 설치된 디스플레이에 표시되는 QR 코드입니다.
              30초마다 자동으로 갱신됩니다.
            </p>
            <StoreQRDisplay 
              storeId="demo-store-id" 
              storeName="강남점"
              refreshInterval={30}
            />
          </div>

          {/* QR 스캐너 */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold mb-6">3. QR 스캐너</h2>
            <p className="text-sm text-gray-700 mb-4">
              직원이 모바일 기기로 QR 코드를 스캔합니다.
            </p>
            <QRScanner 
              onScan={(data) => {
                alert(`스캔된 데이터: ${data}`)
              }}
              onError={(error) => {
                console.error('스캔 오류:', error)
              }}
            />
          </div>
        </div>

        <div className="mt-12 bg-blue-50 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">시스템 특징</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">🔐 보안 기능</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• TOTP 기반 동적 QR 코드 (30초 갱신)</li>
                <li>• AES-256 암호화</li>
                <li>• HMAC-SHA256 서명 검증</li>
                <li>• 위치 기반 검증 (선택적)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">👥 계층적 권한 관리</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• 최상위 관리자: 전체 시스템 관리</li>
                <li>• 지역 관리자: 지역별 매장 관리</li>
                <li>• 매장 관리자: 매장 직원 관리</li>
                <li>• 직원: 본인 출퇴근 기록</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <a href="/" className="text-blue-600 hover:underline mr-4">
            홈으로
          </a>
          <a href="/login" className="text-blue-600 hover:underline mr-4">
            로그인
          </a>
          <a href="/signup/employee" className="text-blue-600 hover:underline">
            직원 회원가입
          </a>
        </div>
      </div>
    </div>
  )
}