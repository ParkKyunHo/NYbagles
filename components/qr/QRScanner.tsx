'use client'

import { useEffect, useRef, useState } from 'react'
import QrScanner from 'qr-scanner'
import { Button } from '@/components/ui/button'

interface QRScannerProps {
  onScan: (data: string) => void
  onError?: (error: Error) => void
}

export function QRScanner({ onScan, onError }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<QrScanner | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [hasCamera, setHasCamera] = useState(true)

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.destroy()
      }
    }
  }, [])

  const startScanning = async () => {
    if (!videoRef.current) return

    try {
      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          // QR code scan successful
          // ScanResult 타입의 data 속성 사용
          onScan(result.data)
          stopScanning()
        },
        {
          returnDetailedScanResult: true,
          preferredCamera: 'environment',
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: 5,
          onDecodeError: (error) => {
            // 디코딩 에러는 정상적인 동작이므로 무시
            const errorMessage = error instanceof Error ? error.message : String(error)
            if (errorMessage && !errorMessage.includes('No QR code found')) {
              // QR decoding error (ignored for 'No QR code found')
            }
          }
        }
      )

      scannerRef.current = scanner
      await scanner.start()
      setIsScanning(true)
    } catch (error) {
      // Camera start failed
      setHasCamera(false)
      onError?.(error as Error)
    }
  }

  const stopScanning = () => {
    if (scannerRef.current) {
      scannerRef.current.stop()
      setIsScanning(false)
    }
  }

  if (!hasCamera) {
    return (
      <div className="text-center p-8">
        <p className="text-red-500 mb-4">카메라에 접근할 수 없습니다.</p>
        <p className="text-sm text-gray-600">
          카메라 권한을 허용하거나 다른 기기를 사용해주세요.
        </p>
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
        />
        
        {!isScanning && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="text-center">
              <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-3 sm:mb-4 bg-gray-300 rounded-lg flex items-center justify-center">
                <svg
                  className="w-10 h-10 sm:w-12 sm:h-12 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                  />
                </svg>
              </div>
              <p className="text-sm sm:text-base text-gray-600">QR 코드를 스캔하려면 시작하세요</p>
            </div>
          </div>
        )}

        {isScanning && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 border-2 border-green-500 opacity-20" />
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-500" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-500" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-500" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-500" />
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 text-center">
        {!isScanning ? (
          <Button onClick={startScanning} size="lg" className="w-full text-sm sm:text-base bg-bagel-yellow hover:bg-bagel-yellow-600 text-bagel-black">
            QR 코드 스캔 시작
          </Button>
        ) : (
          <Button onClick={stopScanning} variant="outline" size="lg" className="w-full text-sm sm:text-base">
            스캔 중지
          </Button>
        )}
      </div>

      {isScanning && (
        <p className="mt-2 text-center text-xs sm:text-sm text-gray-600">
          매장의 QR 코드를 카메라 중앙에 맞춰주세요
        </p>
      )}
    </div>
  )
}