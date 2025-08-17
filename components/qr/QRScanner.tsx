'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import QrScanner from 'qr-scanner'
import { Button } from '@/components/ui/button'
import { Camera, AlertCircle, RefreshCw } from 'lucide-react'

interface QRScannerProps {
  onScan: (data: string) => void
  onError?: (error: Error) => void
}

export function QRScanner({ onScan, onError }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<QrScanner | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [hasCamera, setHasCamera] = useState(true)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown')
  const [availableCameras, setAvailableCameras] = useState<QrScanner.Camera[]>([])
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)

  // Check camera permissions and availability on component mount
  useEffect(() => {
    const initializeCamera = async () => {
      try {
        // Check if QR Scanner and cameras are supported
        const hasCamera = await QrScanner.hasCamera()
        if (!hasCamera) {
          setHasCamera(false)
          setCameraError('카메라가 감지되지 않았습니다.')
          return
        }

        // Get available cameras
        const cameras = await QrScanner.listCameras(true)
        setAvailableCameras(cameras)
        
        // Prefer environment camera (back camera) on mobile
        const backCamera = cameras.find(camera => 
          camera.label.toLowerCase().includes('back') || 
          camera.label.toLowerCase().includes('environment') ||
          camera.label.toLowerCase().includes('rear')
        )
        
        setSelectedCamera(backCamera?.id || cameras[0]?.id || null)

        // Check camera permissions
        if (navigator.permissions) {
          try {
            const permission = await navigator.permissions.query({ name: 'camera' as PermissionName })
            setPermissionStatus(permission.state)
          } catch (err) {
            // Fallback for browsers that don't support permissions API
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

    return () => {
      if (scannerRef.current) {
        scannerRef.current.destroy()
        scannerRef.current = null
      }
    }
  }, [])

  const handleCameraPermissionError = useCallback((error: Error) => {
    const errorMessage = error.message.toLowerCase()
    
    if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
      setCameraError('카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.')
      setPermissionStatus('denied')
    } else if (errorMessage.includes('not found') || errorMessage.includes('notfound')) {
      setCameraError('카메라를 찾을 수 없습니다.')
      setHasCamera(false)
    } else if (errorMessage.includes('not readable') || errorMessage.includes('notreadable')) {
      setCameraError('카메라가 다른 애플리케이션에서 사용 중입니다.')
    } else if (errorMessage.includes('overconstrained')) {
      setCameraError('선택한 카메라가 요구사항을 만족하지 않습니다. 다른 카메라를 시도해보세요.')
    } else {
      setCameraError(`카메라 오류: ${error.message}`)
    }
    
    onError?.(error)
  }, [onError])

  const startScanning = async () => {
    if (!videoRef.current || isInitializing) return

    setIsInitializing(true)
    setCameraError(null)

    try {
      // Mobile-optimized scanner configuration
      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          // QR code scan successful
          onScan(result.data)
          stopScanning()
        },
        {
          returnDetailedScanResult: true,
          // Use selected camera or prefer environment camera
          preferredCamera: selectedCamera || 'environment',
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: 3, // Reduced for better mobile performance
          calculateScanRegion: (video) => {
            // Custom scan region for better mobile experience
            const smallestDimension = Math.min(video.videoWidth, video.videoHeight)
            const scanSize = Math.round(0.7 * smallestDimension)
            
            return {
              x: Math.round((video.videoWidth - scanSize) / 2),
              y: Math.round((video.videoHeight - scanSize) / 2),
              width: scanSize,
              height: scanSize,
            }
          },
          onDecodeError: (error) => {
            // Only log significant decode errors
            const errorMessage = error instanceof Error ? error.message : String(error)
            if (errorMessage && !errorMessage.includes('No QR code found') && !errorMessage.includes('NotFoundException')) {
              console.debug('QR decode error:', errorMessage)
            }
          }
        }
      )

      scannerRef.current = scanner
      
      // Mobile-specific video constraints
      const videoConstraints = {
        facingMode: 'environment', // Back camera
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        aspectRatio: { ideal: 16/9 },
        frameRate: { ideal: 15, max: 30 } // Lower framerate for better performance
      }

      // Start scanner with mobile optimizations
      await scanner.start()
      setIsScanning(true)
      setPermissionStatus('granted')
    } catch (error) {
      console.error('Scanner start error:', error)
      handleCameraPermissionError(error as Error)
      setIsScanning(false)
    } finally {
      setIsInitializing(false)
    }
  }

  const stopScanning = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current.stop()
      setIsScanning(false)
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
    
    const currentIndex = availableCameras.findIndex(cam => cam.id === selectedCamera)
    const nextIndex = (currentIndex + 1) % availableCameras.length
    const nextCamera = availableCameras[nextIndex]
    
    if (isScanning) {
      stopScanning()
    }
    
    setSelectedCamera(nextCamera.id)
    
    // Small delay to ensure previous scanner is stopped
    setTimeout(() => {
      startScanning()
    }, 100)
  }

  if (!hasCamera || cameraError) {
    return (
      <div className="text-center p-8">
        <div className="mb-4">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">카메라 문제</h3>
          <p className="text-red-500 mb-4">{cameraError || '카메라에 접근할 수 없습니다.'}</p>
        </div>
        
        <div className="space-y-3 text-sm text-gray-600">
          {permissionStatus === 'denied' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="font-medium text-yellow-800 mb-2">카메라 권한 설정 방법:</p>
              <ul className="text-left space-y-1 text-yellow-700">
                <li>• 주소창 왼쪽의 카메라 아이콘을 클릭</li>
                <li>• 카메라 권한을 &apos;허용&apos;으로 변경</li>
                <li>• 페이지를 새로고침</li>
              </ul>
            </div>
          )}
          
          <div className="space-y-2">
            <Button onClick={retryCamera} variant="outline" className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              다시 시도
            </Button>
            
            {availableCameras.length > 1 && (
              <Button onClick={switchCamera} variant="outline" size="sm">
                <Camera className="h-4 w-4 mr-2" />
                다른 카메라 사용
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full max-w-sm sm:max-w-md mx-auto">
      <div className="relative aspect-square bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          style={{ display: isScanning ? 'block' : 'none' }}
          playsInline
          autoPlay
          muted
          webkit-playsinline="true" // iOS Safari specific
        />
        
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
        
        {isInitializing && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-bagel-yellow mx-auto mb-4"></div>
              <p className="text-sm text-gray-600">카메라를 시작하는 중...</p>
            </div>
          </div>
        )}

        {isScanning && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Scanning overlay with improved mobile visibility */}
            <div className="absolute inset-0 bg-black bg-opacity-30" />
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-56 h-56 sm:w-64 sm:h-64">
              {/* Animated scanning line */}
              <div className="absolute inset-0 border-2 border-green-400 rounded-lg opacity-80">
                <div className="absolute top-0 left-0 right-0 h-1 bg-green-400 animate-pulse" />
              </div>
              
              {/* Corner markers */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-green-400" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-green-400" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-green-400" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-green-400" />
            </div>
            
            {/* Status indicator */}
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
              <div className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                스캔 중...
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 space-y-3">
        <div className="text-center">
          {!isScanning && !isInitializing ? (
            <Button 
              onClick={startScanning} 
              size="lg" 
              className="w-full text-sm sm:text-base bg-bagel-yellow hover:bg-bagel-yellow-600 text-bagel-black min-h-[44px] touch-manipulation"
              disabled={!hasCamera || !!cameraError}
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
            <Button onClick={stopScanning} variant="outline" size="lg" className="w-full text-sm sm:text-base min-h-[44px] touch-manipulation">
              스캔 중지
            </Button>
          )}
        </div>
        
        {/* Camera switching option */}
        {availableCameras.length > 1 && !isInitializing && (
          <div className="text-center">
            <Button onClick={switchCamera} variant="ghost" size="sm" className="text-xs">
              <RefreshCw className="h-3 w-3 mr-1" />
              카메라 전환 ({availableCameras.findIndex(cam => cam.id === selectedCamera) + 1}/{availableCameras.length})
            </Button>
          </div>
        )}
      </div>

      {isScanning && (
        <div className="mt-3 text-center">
          <p className="text-xs sm:text-sm text-gray-600 mb-2">
            매장의 QR 코드를 녹색 박스 안에 맞춰주세요
          </p>
          <div className="flex items-center justify-center space-x-4 text-xs text-gray-500">
            <span className="flex items-center">
              <div className="w-2 h-2 bg-green-400 rounded-full mr-1"></div>
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
    </div>
  )
}