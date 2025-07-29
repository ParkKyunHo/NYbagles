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
    <div className="container mx-auto px-4 py-4 sm:py-6 max-w-2xl">
      <div className="mb-4 sm:mb-6">
        <Link href="/dashboard/attendance">
          <Button variant="ghost" size="sm" className="text-xs sm:text-sm">
            <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">출퇴근 페이지로 돌아가기</span>
            <span className="sm:hidden">뒤로</span>
          </Button>
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-lg">
        <div className="p-4 sm:p-6 border-b">
          <h1 className="text-lg sm:text-xl font-bold">출퇴근 QR 스캔</h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            매장의 QR 코드를 스캔하세요
          </p>
          {locationError && (
            <p className="text-xs text-yellow-600 mt-2">
              ⚠️ {locationError}
            </p>
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
                <div className="mt-4 text-center">
                  <div className="inline-flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-bagel-yellow mr-2"></div>
                    처리 중...
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              {scanResult.success ? (
                <>
                  <CheckCircle2 className="h-12 w-12 sm:h-16 sm:w-16 text-green-500 mx-auto mb-3 sm:mb-4" />
                  <h3 className="text-lg sm:text-xl font-semibold mb-2">{scanResult.message}</h3>
                  <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
                    잠시 후 대시보드로 이동합니다...
                  </p>
                </>
              ) : (
                <>
                  <XCircle className="h-12 w-12 sm:h-16 sm:w-16 text-red-500 mx-auto mb-3 sm:mb-4" />
                  <h3 className="text-lg sm:text-xl font-semibold mb-2">오류 발생</h3>
                  <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">{scanResult.message}</p>
                  <Button onClick={() => setScanResult(null)} className="text-sm sm:text-base">
                    다시 스캔하기
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 sm:mt-6 text-center text-xs sm:text-sm text-gray-600">
        <p>문제가 있나요?</p>
        <p>매장 관리자에게 문의하세요.</p>
      </div>
    </div>
  )
}