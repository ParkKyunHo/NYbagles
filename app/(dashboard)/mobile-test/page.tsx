'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { QRScanner } from '@/components/qr/QRScanner'
import { Camera, Smartphone, Monitor, Wifi, Battery, Signal } from 'lucide-react'

export default function MobileTestPage() {
  const [showQRScanner, setShowQRScanner] = useState(false)
  const [deviceInfo, setDeviceInfo] = useState<any>(null)
  const [cameraPermissions, setCameraPermissions] = useState<string>('unknown')

  const checkDeviceInfo = () => {
    const info = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      online: navigator.onLine,
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: (navigator as any).deviceMemory || 'unknown',
      connection: (navigator as any).connection ? {
        effectiveType: (navigator as any).connection.effectiveType,
        downlink: (navigator as any).connection.downlink,
        rtt: (navigator as any).connection.rtt,
      } : 'unknown',
      screen: {
        width: screen.width,
        height: screen.height,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight,
        pixelDepth: screen.pixelDepth,
        orientation: screen.orientation?.type || 'unknown',
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
      },
      touch: 'ontouchstart' in window,
      geolocation: 'geolocation' in navigator,
      serviceWorker: 'serviceWorker' in navigator,
      webShare: 'share' in navigator,
      webGL: !!document.createElement('canvas').getContext('webgl'),
    }
    setDeviceInfo(info)
  }

  const checkCameraPermissions = async () => {
    try {
      if (navigator.permissions) {
        const permission = await navigator.permissions.query({ name: 'camera' as PermissionName })
        setCameraPermissions(permission.state)
      } else {
        setCameraPermissions('permissions API not supported')
      }
    } catch (error) {
      setCameraPermissions('error checking permissions')
    }
  }

  const handleQRScan = (data: string) => {
    alert(`QR 스캔 성공: ${data}`)
    setShowQRScanner(false)
  }

  const handleQRError = (error: Error) => {
    alert(`QR 스캔 오류: ${error.message}`)
  }

  const testVibration = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200])
      alert('진동 테스트 완료')
    } else {
      alert('진동 API가 지원되지 않습니다')
    }
  }

  const testOrientation = () => {
    if (screen.orientation) {
      alert(`현재 화면 방향: ${screen.orientation.type}`)
    } else {
      alert('화면 방향 API가 지원되지 않습니다')
    }
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">모바일 기능 테스트</h1>
        <p className="text-sm text-gray-600">
          모든 모바일 기능이 올바르게 작동하는지 테스트합니다.
        </p>
      </div>

      <div className="grid gap-6">
        {/* 기기 정보 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-lg font-semibold mb-3 flex items-center">
            <Smartphone className="h-5 w-5 mr-2" />
            기기 정보
          </h2>
          <div className="space-y-3">
            <Button onClick={checkDeviceInfo} className="w-full">
              기기 정보 확인
            </Button>
            {deviceInfo && (
              <div className="bg-gray-50 rounded-lg p-3 text-xs">
                <pre className="whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(deviceInfo, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* 카메라 테스트 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-lg font-semibold mb-3 flex items-center">
            <Camera className="h-5 w-5 mr-2" />
            카메라 및 QR 스캐너 테스트
          </h2>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button onClick={checkCameraPermissions} variant="outline" size="sm">
                카메라 권한 확인
              </Button>
              <Button onClick={() => setShowQRScanner(!showQRScanner)} size="sm">
                {showQRScanner ? 'QR 스캐너 숨기기' : 'QR 스캐너 테스트'}
              </Button>
            </div>
            {cameraPermissions !== 'unknown' && (
              <p className={`text-sm ${
                cameraPermissions === 'granted' ? 'text-green-600' : 'text-red-600'
              }`}>
                카메라 권한 상태: {cameraPermissions}
              </p>
            )}
            {showQRScanner && (
              <div className="mt-4">
                <QRScanner onScan={handleQRScan} onError={handleQRError} />
              </div>
            )}
          </div>
        </div>

        {/* 터치 및 제스처 테스트 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-lg font-semibold mb-3 flex items-center">
            <Monitor className="h-5 w-5 mr-2" />
            터치 및 제스처 테스트
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={testVibration} variant="outline" className="touch-manipulation">
              진동 테스트
            </Button>
            <Button onClick={testOrientation} variant="outline" className="touch-manipulation">
              화면 방향 테스트
            </Button>
          </div>
        </div>

        {/* 네트워크 상태 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-lg font-semibold mb-3 flex items-center">
            <Wifi className="h-5 w-5 mr-2" />
            네트워크 상태
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>온라인 상태:</span>
              <span className={navigator.onLine ? 'text-green-600' : 'text-red-600'}>
                {navigator.onLine ? '온라인' : '오프라인'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>쿠키 활성화:</span>
              <span className={navigator.cookieEnabled ? 'text-green-600' : 'text-red-600'}>
                {navigator.cookieEnabled ? '활성화됨' : '비활성화됨'}
              </span>
            </div>
          </div>
        </div>

        {/* 뷰포트 및 화면 정보 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-lg font-semibold mb-3 flex items-center">
            <Monitor className="h-5 w-5 mr-2" />
            화면 및 뷰포트 정보
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-medium mb-2">화면 크기</h3>
              <p>가로: {screen.width}px</p>
              <p>세로: {screen.height}px</p>
              <p>픽셀 비율: {window.devicePixelRatio}</p>
            </div>
            <div>
              <h3 className="font-medium mb-2">뷰포트 크기</h3>
              <p>가로: {window.innerWidth}px</p>
              <p>세로: {window.innerHeight}px</p>
              <p>사용 가능 높이: {screen.availHeight}px</p>
            </div>
          </div>
        </div>

        {/* 브라우저 기능 지원 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-lg font-semibold mb-3 flex items-center">
            <Battery className="h-5 w-5 mr-2" />
            브라우저 기능 지원
          </h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              { name: '터치 지원', value: 'ontouchstart' in window },
              { name: '위치 정보', value: 'geolocation' in navigator },
              { name: '서비스 워커', value: 'serviceWorker' in navigator },
              { name: '웹 공유', value: 'share' in navigator },
              { name: '진동', value: 'vibrate' in navigator },
              { name: 'WebGL', value: !!document.createElement('canvas').getContext('webgl') },
              { name: '카메라 API', value: 'mediaDevices' in navigator },
              { name: '권한 API', value: 'permissions' in navigator },
            ].map(feature => (
              <div key={feature.name} className="flex items-center justify-between py-1">
                <span>{feature.name}:</span>
                <span className={feature.value ? 'text-green-600' : 'text-red-600'}>
                  {feature.value ? '지원됨' : '미지원'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 성능 테스트 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-lg font-semibold mb-3 flex items-center">
            <Signal className="h-5 w-5 mr-2" />
            성능 정보
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>CPU 코어 수:</span>
              <span>{navigator.hardwareConcurrency || '알 수 없음'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>메모리 (GB):</span>
              <span>{(navigator as any).deviceMemory || '알 수 없음'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>언어:</span>
              <span>{navigator.language}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>플랫폼:</span>
              <span>{navigator.platform}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 하단 안내 */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">테스트 가이드</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• 카메라 권한을 허용한 후 QR 스캐너를 테스트하세요</li>
          <li>• 터치 버튼들이 44px 이상의 크기로 표시되는지 확인하세요</li>
          <li>• 화면을 회전시켜 반응형 레이아웃을 확인하세요</li>
          <li>• 진동 기능이 지원되는 기기에서 진동을 테스트하세요</li>
        </ul>
      </div>
    </div>
  )
}