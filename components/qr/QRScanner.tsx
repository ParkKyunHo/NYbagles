'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { QrScanner } from '@yudiel/react-qr-scanner'
import { Button } from '@/components/ui/button'
import { Camera, AlertCircle, RefreshCw, Upload, X } from 'lucide-react'
import { detectDevice, isIOSDevice, isCameraSupported } from '@/lib/utils/device-detection'

interface QRScannerProps {
  onScan: (data: string) => void
  onError?: (error: Error) => void
}

export function QRScanner({ onScan, onError }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [hasCamera, setHasCamera] = useState(true)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown')
  const [deviceInfo, setDeviceInfo] = useState<ReturnType<typeof detectDevice> | null>(null)
  const [isHttps, setIsHttps] = useState(true)
  const [showFileUpload, setShowFileUpload] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hasScannedRef = useRef(false)
  const [retryCount, setRetryCount] = useState(0)
  const maxRetries = 3

  // Initialize camera on mount
  useEffect(() => {
    const initializeCamera = async () => {
      try {
        // Check HTTPS requirement
        if (typeof window !== 'undefined') {
          const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost'
          setIsHttps(isSecure)
          
          if (!isSecure) {
            setCameraError('카메라 사용을 위해 HTTPS 연결이 필요합니다.')
            setHasCamera(false)
            return
          }
        }
        
        // Detect device
        const device = detectDevice()
        setDeviceInfo(device)
        
        // Check camera support
        if (!isCameraSupported()) {
          setHasCamera(false)
          setCameraError('카메라가 지원되지 않습니다.')
          return
        }

        // Check permissions
        if (navigator.permissions) {
          try {
            const permission = await navigator.permissions.query({ name: 'camera' as PermissionName })
            setPermissionStatus(permission.state)
            
            permission.addEventListener('change', () => {
              setPermissionStatus(permission.state)
            })
          } catch {
            setPermissionStatus('unknown')
          }
        }
      } catch (error) {
        console.error('Camera initialization error:', error)
        setCameraError('카메라 초기화 중 오류가 발생했습니다.')
        setHasCamera(false)
      }
    }

    initializeCamera()
  }, [])

  const handleScan = useCallback((result: string) => {
    // Prevent duplicate scans
    if (!hasScannedRef.current && result) {
      hasScannedRef.current = true
      
      // Vibrate if supported
      if (navigator.vibrate) {
        navigator.vibrate(200)
      }
      
      // Call onScan callback
      onScan(result)
      
      // Stop scanning
      setIsScanning(false)
      
      // Reset scan flag after a delay
      setTimeout(() => {
        hasScannedRef.current = false
      }, 1000)
    }
  }, [onScan])

  const handleError = useCallback((error: any) => {
    const errorMessage = error?.message?.toLowerCase() || String(error).toLowerCase()
    
    if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
      setCameraError('카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.')
      setPermissionStatus('denied')
    } else if (errorMessage.includes('not found') || errorMessage.includes('notfound')) {
      setCameraError('카메라를 찾을 수 없습니다.')
      setHasCamera(false)
    } else if (errorMessage.includes('not readable') || errorMessage.includes('notreadable')) {
      setCameraError('카메라가 다른 애플리케이션에서 사용 중입니다.')
    } else if (errorMessage.includes('overconstrained')) {
      setCameraError('선택한 카메라가 요구사항을 만족하지 않습니다.')
    } else if (errorMessage.includes('not allowed') || errorMessage.includes('notallowed')) {
      setCameraError('카메라 사용이 허용되지 않았습니다. HTTPS 연결인지 확인해주세요.')
    } else if (errorMessage.includes('insecure')) {
      setCameraError('보안되지 않은 연결에서는 카메라를 사용할 수 없습니다.')
    } else {
      // Don't show "no QR code found" errors
      if (!errorMessage.includes('no qr') && !errorMessage.includes('not found')) {
        setCameraError(`카메라 오류: ${error?.message || error}`)
      }
    }
    
    if (onError && !errorMessage.includes('no qr')) {
      onError(error instanceof Error ? error : new Error(String(error)))
    }
  }, [onError])

  const startScanning = () => {
    setCameraError(null)
    hasScannedRef.current = false
    setIsScanning(true)
    setRetryCount(0)
  }

  const stopScanning = () => {
    setIsScanning(false)
    hasScannedRef.current = false
  }

  const retryCamera = () => {
    setCameraError(null)
    setHasCamera(true)
    setPermissionStatus('unknown')
    setRetryCount(prev => prev + 1)
    startScanning()
  }

  // Handle file upload fallback
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      // Create a temporary image element to read the QR code
      const img = new Image()
      const reader = new FileReader()
      
      reader.onload = (e) => {
        img.src = e.target?.result as string
        img.onload = async () => {
          // Use the Scanner component's scan method if available
          // For now, we'll use a basic approach
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            throw new Error('Canvas context not available')
          }
          
          canvas.width = img.width
          canvas.height = img.height
          ctx.drawImage(img, 0, 0)
          
          // Note: Actual QR code scanning from image would require additional library
          // This is a placeholder for the functionality
          setCameraError('이미지에서 QR 코드를 읽는 기능은 곧 추가될 예정입니다.')
        }
      }
      
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('File scan error:', error)
      setCameraError('QR 코드를 읽을 수 없습니다. 다른 이미지를 시도해주세요.')
    }
    
    // Clear the input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    setShowFileUpload(false)
  }

  // Error state
  if (!hasCamera || (cameraError && !isScanning)) {
    return (
      <div className="text-center p-8">
        <div className="mb-4">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">카메라 문제</h3>
          <p className="text-red-500 mb-4">{cameraError || '카메라에 접근할 수 없습니다.'}</p>
        </div>
        
        {!isHttps && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="font-medium text-red-800 mb-2">HTTPS 연결 필요</p>
            <p className="text-sm text-red-700">
              카메라 사용을 위해서는 보안 연결(HTTPS)이 필요합니다.
              사이트 주소가 https://로 시작하는지 확인해주세요.
            </p>
          </div>
        )}
        
        <div className="space-y-3 text-sm text-gray-600">
          {permissionStatus === 'denied' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="font-medium text-yellow-800 mb-2">카메라 권한 설정 방법:</p>
              {deviceInfo?.isIOS ? (
                <ul className="text-left space-y-1 text-yellow-700">
                  <li>• 설정 앱 열기</li>
                  <li>• Safari 또는 사용 중인 브라우저 선택</li>
                  <li>• 카메라 권한을 &apos;허용&apos;으로 변경</li>
                  <li>• 브라우저를 완전히 닫고 다시 열기</li>
                </ul>
              ) : (
                <ul className="text-left space-y-1 text-yellow-700">
                  <li>• 주소창 왼쪽의 자물쇠/카메라 아이콘 클릭</li>
                  <li>• 카메라 권한을 &apos;허용&apos;으로 변경</li>
                  <li>• 페이지 새로고침</li>
                </ul>
              )}
            </div>
          )}
          
          <div className="space-y-2">
            {retryCount < maxRetries && (
              <Button onClick={retryCamera} variant="outline" className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                다시 시도 ({retryCount + 1}/{maxRetries})
              </Button>
            )}
            
            {/* File upload fallback */}
            <div className="pt-2 border-t">
              <p className="text-xs text-gray-500 mb-2">카메라를 사용할 수 없나요?</p>
              <Button 
                onClick={() => setShowFileUpload(true)} 
                variant="secondary" 
                size="sm"
                className="w-full"
              >
                QR 코드 이미지 업로드
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full max-w-sm sm:max-w-md mx-auto">
      <div className="relative aspect-square bg-black rounded-lg overflow-hidden">
        {/* QR Scanner */}
        {isScanning ? (
          <div className="w-full h-full">
            <QrScanner
              onDecode={(result: string) => {
                handleScan(result)
              }}
              onError={handleError}
              constraints={{
                facingMode: deviceInfo?.isMobile ? 'environment' : 'user',
              }}
              tracker={false}
              hideCount={true}
              audio={false}
              containerStyle={{
                width: '100%',
                height: '100%',
              }}
              videoStyle={{
                width: '100%',
                height: '100%',
                objectFit: 'cover' as any,
              }}
            />
            
            {/* Scanning overlay */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 bg-black bg-opacity-20" />
              
              {/* Status indicator */}
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
                <div className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                  스캔 중...
                </div>
              </div>
              
              {/* Scanning frame */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-56 h-56 sm:w-64 sm:h-64">
                {/* Animated scanning line */}
                <div className="absolute inset-0 border-2 border-green-400 rounded-lg">
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-green-400 animate-pulse" />
                </div>
                
                {/* Corner markers */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-green-400 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-green-400 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-green-400 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-green-400 rounded-br-lg" />
              </div>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="text-center">
              <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-3 sm:mb-4 bg-gray-300 rounded-lg flex items-center justify-center">
                <Camera className="w-10 h-10 sm:w-12 sm:h-12 text-gray-700" />
              </div>
              <p className="text-sm sm:text-base text-gray-600">QR 코드를 스캔하려면 시작하세요</p>
            </div>
          </div>
        )}
      </div>

      {/* Control buttons */}
      <div className="mt-4 space-y-3">
        <div className="text-center">
          {!isScanning ? (
            <Button 
              onClick={startScanning} 
              size="lg" 
              className="w-full text-sm sm:text-base bg-bagel-yellow hover:bg-bagel-yellow-600 text-bagel-black min-h-[44px] touch-manipulation"
              disabled={!hasCamera || !!cameraError}
            >
              <Camera className="h-4 w-4 mr-2" />
              QR 코드 스캔 시작
            </Button>
          ) : (
            <Button 
              onClick={stopScanning} 
              variant="outline" 
              size="lg" 
              className="w-full text-sm sm:text-base min-h-[44px] touch-manipulation"
            >
              스캔 중지
            </Button>
          )}
        </div>
      </div>

      {/* Scanning tips */}
      {isScanning && (
        <div className="mt-3 text-center">
          <p className="text-xs sm:text-sm text-gray-600 mb-2">
            매장의 QR 코드를 녹색 박스 안에 맞춰주세요
          </p>
          <div className="flex items-center justify-center space-x-4 text-xs text-gray-500">
            <span className="flex items-center">
              <div className="w-2 h-2 bg-green-400 rounded-full mr-1 animate-pulse"></div>
              카메라 활성
            </span>
            {permissionStatus === 'granted' && (
              <span className="flex items-center">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-1"></div>
                권한 허용됨
              </span>
            )}
          </div>
        </div>
      )}
      
      {/* File upload modal */}
      {showFileUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-sm w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">QR 코드 이미지 업로드</h3>
              <Button
                onClick={() => setShowFileUpload(false)}
                variant="ghost"
                size="sm"
                className="p-1"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="qr-file-input"
                />
                <label
                  htmlFor="qr-file-input"
                  className="cursor-pointer"
                >
                  <div className="mb-3">
                    <Upload className="h-12 w-12 text-gray-400 mx-auto" />
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    클릭하여 이미지 선택
                  </p>
                  <p className="text-xs text-gray-500">
                    JPG, PNG 형식 지원
                  </p>
                </label>
              </div>
              
              <Button
                onClick={() => setShowFileUpload(false)}
                variant="outline"
                className="w-full"
              >
                취소
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}