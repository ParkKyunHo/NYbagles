'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { QRScanner } from '@/components/qr/QRScanner'
import { Button } from '@/components/ui/button'
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react'
import Link from 'next/link'

export default function QRScanPage() {
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(false)
  const [scanResult, setScanResult] = useState<{
    success: boolean
    message: string
    type?: 'checkin' | 'checkout'
  } | null>(null)
  const [location, setLocation] = useState<GeolocationCoordinates | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)

  useEffect(() => {
    // 위치 정보 가져오기
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation(position.coords)
        },
        (error) => {
          console.error('위치 정보 오류:', error)
          setLocationError('위치 정보를 가져올 수 없습니다. 위치 권한을 확인해주세요.')
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      )
    }
  }, [])

  const handleScan = async (data: string) => {
    if (isProcessing) return
    
    setIsProcessing(true)
    setScanResult(null)

    try {
      // 위치 정보가 없으면 경고
      if (!location && !locationError) {
        const confirmWithoutLocation = confirm('위치 정보 없이 진행하시겠습니까?')
        if (!confirmWithoutLocation) {
          setIsProcessing(false)
          return
        }
      }

      // API 호출
      const response = await fetch('/api/qr/checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          qrData: data,
          location: location ? {
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy
          } : null
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '체크인/체크아웃 처리 중 오류가 발생했습니다.')
      }

      // 성공
      setScanResult({
        success: true,
        message: result.type === 'checkin' 
          ? '출근이 기록되었습니다!' 
          : '퇴근이 기록되었습니다!',
        type: result.type,
      })
      
      // 3초 후 대시보드로 이동
      setTimeout(() => {
        router.push('/dashboard')
      }, 3000)
    } catch (error) {
      console.error('QR 처리 오류:', error)
      const message = error instanceof Error ? error.message : '처리 중 오류가 발생했습니다.'
      
      setScanResult({
        success: false,
        message,
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleError = (error: Error) => {
    console.error('스캐너 오류:', error)
    setScanResult({
      success: false,
      message: '카메라 접근에 실패했습니다. 권한을 확인해주세요.'
    })
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-2xl">
      <div className="mb-4 sm:mb-6">
        <Link href="/attendance">
          <Button variant="ghost" size="sm" className="text-xs sm:text-sm min-h-[44px] touch-manipulation">
            <ArrowLeft className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="hidden sm:inline">출퇴근 페이지로 돌아가기</span>
            <span className="sm:hidden">뒤로</span>
          </Button>
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 sm:p-6 border-b border-gray-100">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">출퇴근 QR 스캔</h1>
          <p className="text-sm text-gray-600 mt-1">
            매장의 QR 코드를 스캔하세요
          </p>
          {locationError && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800 flex items-start">
                <span className="mr-2">⚠️</span>
                <span>{locationError}</span>
              </p>
            </div>
          )}
        </div>
        <div className="p-4 sm:p-6">
          {!scanResult ? (
            <>
              <QRScanner 
                onScan={handleScan} 
                onError={handleError}
              />
              {isProcessing && (
                <div className="mt-6 text-center">
                  <div className="inline-flex items-center justify-center p-4 bg-bagel-yellow-50 rounded-lg">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-bagel-yellow border-t-transparent mr-3"></div>
                    <span className="text-bagel-black font-medium">처리 중...</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 sm:py-12">
              {scanResult.success ? (
                <div className="space-y-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="h-8 w-8 sm:h-10 sm:w-10 text-green-500" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">{scanResult.message}</h3>
                    <p className="text-sm text-gray-600 mb-4 sm:mb-6">
                      잠시 후 대시보드로 이동합니다...
                    </p>
                    <div className="flex items-center justify-center space-x-2 text-sm text-green-600">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-green-600 border-t-transparent"></div>
                      <span>이동 중...</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                    <XCircle className="h-8 w-8 sm:h-10 sm:w-10 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">오류 발생</h3>
                    <p className="text-sm text-gray-600 mb-6">{scanResult.message}</p>
                    <Button 
                      onClick={() => setScanResult(null)} 
                      className="min-h-[44px] touch-manipulation bg-bagel-yellow hover:bg-bagel-yellow-600 text-bagel-black px-6"
                    >
                      다시 스캔하기
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 text-center">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">문제가 있나요?</p>
          <p className="text-sm text-gray-500">매장 관리자에게 문의하세요.</p>
        </div>
      </div>
    </div>
  )
}