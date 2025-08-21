'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Html5Qrcode, Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { Button } from '@/components/ui/button'
import { Camera, AlertCircle, RefreshCw, Flashlight } from 'lucide-react'
import { detectDevice, isIOSDevice } from '@/lib/utils/device-detection'
import '@/styles/qr-scanner.css'

interface QRScannerProps {
  onScan: (data: string) => void
  onError?: (error: Error) => void
}

export function QRScanner({ onScan, onError }: QRScannerProps) {
  const scannerContainerRef = useRef<HTMLDivElement>(null)
  const scannerInstanceRef = useRef<Html5Qrcode | null>(null)
  const hasScannedRef = useRef(false)
  const retryCountRef = useRef(0)
  const maxRetries = 3
  
  const [isScanning, setIsScanning] = useState(false)
  const [hasCamera, setHasCamera] = useState(true)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown')
  const [availableCameras, setAvailableCameras] = useState<any[]>([])
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)
  const [deviceInfo, setDeviceInfo] = useState<ReturnType<typeof detectDevice> | null>(null)
  const [hasTorch, setHasTorch] = useState(false)
  const [isTorchOn, setIsTorchOn] = useState(false)
  const [isHttps, setIsHttps] = useState(true)
  const [showFileUpload, setShowFileUpload] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
        
        // iOS needs a small delay for stability
        if (device.isIOS) {
          await new Promise(resolve => setTimeout(resolve, 200))
        }

        // Get available cameras
        const devices = await Html5Qrcode.getCameras()
        
        if (!devices || devices.length === 0) {
          setHasCamera(false)
          setCameraError('카메라가 감지되지 않았습니다.')
          return
        }

        setAvailableCameras(devices)
        
        // Select preferred camera (back camera for mobile)
        let preferredCamera = devices[0]
        
        if (device.isMobile) {
          // Look for back camera
          const backCamera = devices.find(device => {
            const label = device.label?.toLowerCase() || ''
            return label.includes('back') || 
                   label.includes('environment') ||
                   label.includes('rear') ||
                   label.includes('후면') ||
                   label.includes('main')
          })
          
          if (backCamera) {
            preferredCamera = backCamera
          } else if (devices.length > 1) {
            // If no back camera found, use the second camera (usually back)
            preferredCamera = devices[1]
          }
        }
        
        setSelectedCameraId(preferredCamera.id)

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

    // Cleanup on unmount
    return () => {
      if (scannerInstanceRef.current) {
        scannerInstanceRef.current.stop().catch(console.error)
        scannerInstanceRef.current = null
      }
    }
  }, [])

  const handleCameraPermissionError = useCallback((error: any) => {
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
      setCameraError(`카메라 오류: ${error?.message || error}`)
    }
    
    onError?.(error instanceof Error ? error : new Error(String(error)))
  }, [onError])

  const startScanning = async () => {
    if (!scannerContainerRef.current || isInitializing) return

    setIsInitializing(true)
    setCameraError(null)
    hasScannedRef.current = false

    try {
      // Stop any existing scanner instance
      if (scannerInstanceRef.current) {
        try {
          await scannerInstanceRef.current.stop()
        } catch (e) {
          console.log('Previous scanner cleanup:', e)
        }
        scannerInstanceRef.current = null
      }

      // Small delay to ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 100))

      // Create scanner instance
      const html5QrCode = new Html5Qrcode('qr-reader', {
        verbose: process.env.NODE_ENV === 'development', // Only verbose in dev
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      })
      
      scannerInstanceRef.current = html5QrCode

      // Device-specific configuration
      const isIOS = deviceInfo?.isIOS || isIOSDevice()
      const isMobile = deviceInfo?.isMobile || false
      
      // Calculate optimal QR box size based on viewport
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const minDimension = Math.min(viewportWidth, viewportHeight)
      const qrboxSize = Math.floor(minDimension * 0.7) // 70% of smallest dimension
      
      const config = {
        fps: isMobile ? 5 : 10, // Lower FPS for mobile performance
        qrbox: { width: qrboxSize, height: qrboxSize },
        disableFlip: false,
        rememberLastUsedCamera: true,
        showTorchButtonIfSupported: false,
        // Disable verbose mode in production for better performance
        verbose: process.env.NODE_ENV === 'development'
      }

      // Use facingMode only for mobile, avoid conflicts
      const cameraIdOrConstraints = isMobile ? 
        { facingMode: 'environment' } : 
        (selectedCameraId || { facingMode: 'environment' })
      
      console.log('Starting QR scanner with config:', {
        cameraIdOrConstraints,
        qrboxSize,
        isMobile,
        isIOS,
        selectedCameraId
      })
      
      await html5QrCode.start(
        cameraIdOrConstraints,
        config,
        async (decodedText) => {
          // Prevent duplicate scans
          if (!hasScannedRef.current) {
            hasScannedRef.current = true
            
            // Vibrate if supported
            if (navigator.vibrate) {
              navigator.vibrate(200)
            }
            
            // Call onScan callback
            onScan(decodedText)
            
            // Stop scanning
            await stopScanning()
          }
        },
        (errorMessage) => {
          // Silent fail for "no QR code found" errors
          if (!errorMessage.includes('NotFoundException') && 
              !errorMessage.includes('No MultiFormat Readers')) {
            console.debug('QR scan error:', errorMessage)
          }
        }
      )
      
      setIsScanning(true)
      setPermissionStatus('granted')
      retryCountRef.current = 0 // Reset retry count on successful start
      
      // Add iOS-specific video attributes after scanner starts
      if (isIOS) {
        setTimeout(() => {
          const videoElement = document.querySelector('#qr-reader video') as HTMLVideoElement
          if (videoElement) {
            videoElement.setAttribute('autoplay', 'true')
            videoElement.setAttribute('muted', 'true')
            videoElement.setAttribute('playsinline', 'true')
            videoElement.setAttribute('webkit-playsinline', 'true')
            // Force play on iOS
            videoElement.play().catch(console.error)
          }
        }, 100)
      }
      
      // Check for torch support (disabled due to TypeScript issues)
      // Torch functionality will be available in future updates
      setHasTorch(false)
      
    } catch (error) {
      console.error('Scanner start error:', error)
      handleCameraPermissionError(error)
      setIsScanning(false)
      
      // Auto-retry with exponential backoff
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++
        const retryDelay = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 5000)
        console.log(`Retrying camera initialization (${retryCountRef.current}/${maxRetries}) in ${retryDelay}ms`)
        setTimeout(() => {
          startScanning()
        }, retryDelay)
      }
    } finally {
      setIsInitializing(false)
    }
  }

  const stopScanning = useCallback(async () => {
    if (scannerInstanceRef.current) {
      try {
        await scannerInstanceRef.current.stop()
        scannerInstanceRef.current = null
        setIsScanning(false)
        setIsTorchOn(false)
        setHasTorch(false)
      } catch (error) {
        console.error('Error stopping scanner:', error)
      }
    }
  }, [])

  const retryCamera = async () => {
    setCameraError(null)
    setHasCamera(true)
    setPermissionStatus('unknown')
    await startScanning()
  }

  const switchCamera = async () => {
    if (availableCameras.length <= 1) return
    
    const currentIndex = availableCameras.findIndex(cam => cam.id === selectedCameraId)
    const nextIndex = (currentIndex + 1) % availableCameras.length
    const nextCamera = availableCameras[nextIndex]
    
    if (isScanning) {
      await stopScanning()
    }
    
    setSelectedCameraId(nextCamera.id)
    
    // Small delay to ensure cleanup
    setTimeout(() => {
      startScanning()
    }, 200)
  }

  const toggleTorch = async () => {
    if (!scannerInstanceRef.current || !hasTorch) return
    
    try {
      const newTorchState = !isTorchOn
      // Torch toggle temporarily disabled due to TypeScript compatibility
      // Will be re-enabled in future updates
      console.log('Torch toggle requested:', newTorchState)
      setIsTorchOn(newTorchState)
    } catch (error) {
      console.error('Torch toggle error:', error)
    }
  }

  // Handle file upload fallback
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const html5QrCode = new Html5Qrcode('qr-reader-file')
      const result = await html5QrCode.scanFile(file, true)
      onScan(result)
      setShowFileUpload(false)
      
      // Vibrate if supported
      if (navigator.vibrate) {
        navigator.vibrate(200)
      }
    } catch (error) {
      console.error('File scan error:', error)
      setCameraError('QR 코드를 읽을 수 없습니다. 다른 이미지를 시도해주세요.')
    }
    
    // Clear the input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Error state
  if (!hasCamera || cameraError) {
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
            <Button onClick={retryCamera} variant="outline" className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              다시 시도
            </Button>
            
            {availableCameras.length > 1 && (
              <Button onClick={switchCamera} variant="outline" size="sm" className="w-full">
                <Camera className="h-4 w-4 mr-2" />
                다른 카메라 사용
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
        {/* QR Scanner Container */}
        <div 
          id="qr-reader" 
          ref={scannerContainerRef}
          className="w-full h-full qr-scanner-container"
          style={{ 
            display: isScanning ? 'block' : 'none',
            position: 'relative',
            backgroundColor: 'black'
          }}
        />
        
        {/* Placeholder when not scanning */}
        {!isScanning && !isInitializing && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="text-center">
              <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-3 sm:mb-4 bg-gray-300 rounded-lg flex items-center justify-center">
                <Camera className="w-10 h-10 sm:w-12 sm:h-12 text-gray-700" />
              </div>
              <p className="text-sm sm:text-base text-gray-600">QR 코드를 스캔하려면 시작하세요</p>
              {availableCameras.length > 1 && (
                <p className="text-xs text-gray-500 mt-2">
                  {availableCameras.length}개의 카메라 사용 가능
                </p>
              )}
            </div>
          </div>
        )}
        
        {/* Loading state */}
        {isInitializing && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-bagel-yellow mx-auto mb-4"></div>
              <p className="text-sm text-gray-600">카메라를 시작하는 중...</p>
            </div>
          </div>
        )}

        {/* Scanning overlay */}
        {isScanning && (
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
        )}
      </div>

      {/* Control buttons */}
      <div className="mt-4 space-y-3">
        <div className="text-center">
          {!isScanning && !isInitializing ? (
            <Button 
              onClick={startScanning} 
              size="lg" 
              className="w-full text-sm sm:text-base bg-bagel-yellow hover:bg-bagel-yellow-600 text-bagel-black min-h-[44px] touch-manipulation"
              disabled={!hasCamera || !!cameraError || !selectedCameraId}
            >
              <Camera className="h-4 w-4 mr-2" />
              QR 코드 스캔 시작
            </Button>
          ) : isInitializing ? (
            <Button size="lg" className="w-full text-sm sm:text-base" disabled>
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
              초기화 중...
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button 
                onClick={stopScanning} 
                variant="outline" 
                size="lg" 
                className="flex-1 text-sm sm:text-base min-h-[44px] touch-manipulation"
              >
                스캔 중지
              </Button>
              
              {hasTorch && (
                <Button
                  onClick={toggleTorch}
                  variant={isTorchOn ? "secondary" : "outline"}
                  size="lg"
                  className="min-h-[44px] touch-manipulation px-4"
                  title="플래시"
                >
                  <Flashlight className={`h-4 w-4 ${isTorchOn ? 'text-yellow-400' : ''}`} />
                </Button>
              )}
            </div>
          )}
        </div>
        
        {/* Camera switching */}
        {availableCameras.length > 1 && !isInitializing && (
          <div className="text-center">
            <Button onClick={switchCamera} variant="ghost" size="sm" className="text-xs">
              <RefreshCw className="h-3 w-3 mr-1" />
              카메라 전환 ({availableCameras.findIndex(cam => cam.id === selectedCameraId) + 1}/{availableCameras.length})
            </Button>
          </div>
        )}
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
            <h3 className="text-lg font-semibold mb-4">QR 코드 이미지 업로드</h3>
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
                    <Camera className="h-12 w-12 text-gray-400 mx-auto" />
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    클릭하여 이미지 선택
                  </p>
                  <p className="text-xs text-gray-500">
                    JPG, PNG 형식 지원
                  </p>
                </label>
              </div>
              
              {/* Hidden div for file scanner */}
              <div id="qr-reader-file" style={{ display: 'none' }} />
              
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
      
      {/* Add custom styles for html5-qrcode */}
      <style jsx global>{`
        #qr-reader {
          position: relative !important;
          padding: 0 !important;
          border: none !important;
          width: 100% !important;
          height: 100% !important;
          background: black !important;
        }
        
        #qr-reader video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          display: block !important;
        }
        
        #qr-reader__scan_region {
          position: absolute !important;
          top: 50% !important;
          left: 50% !important;
          transform: translate(-50%, -50%) !important;
          z-index: 10 !important;
          background: transparent !important;
        }
        
        #qr-reader__dashboard {
          display: none !important;
        }
        
        #qr-reader__dashboard_section_csr {
          display: none !important;
        }
        
        #qr-reader__dashboard_section_fsr {
          display: none !important;
        }
        
        #qr-reader__dashboard_section_swaplink {
          display: none !important;
        }
        
        #qr-shaded-region {
          background: transparent !important;
        }
        
        /* Ensure video visibility on mobile */
        @media (max-width: 640px) {
          #qr-reader video {
            min-width: 100% !important;
            min-height: 100% !important;
            width: auto !important;
            height: auto !important;
          }
        }
      `}</style>
    </div>
  )
}