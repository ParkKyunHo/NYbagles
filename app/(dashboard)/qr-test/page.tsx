'use client'

import { useState } from 'react'
import { QRScanner } from '@/components/qr/QRScanner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, AlertCircle } from 'lucide-react'

export default function QRTestPage() {
  const [scanResult, setScanResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showScanner, setShowScanner] = useState(false)

  const handleScan = (data: string) => {
    setScanResult(data)
    setError(null)
    setShowScanner(false)
    
    // Vibrate on successful scan
    if (navigator.vibrate) {
      navigator.vibrate(200)
    }
  }

  const handleError = (err: Error) => {
    setError(err.message)
    console.error('QR Scanner error:', err)
  }

  const resetTest = () => {
    setScanResult(null)
    setError(null)
    setShowScanner(false)
  }

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>QR Scanner Test</CardTitle>
          <CardDescription>
            Test the new QR scanner implementation with @yudiel/react-qr-scanner
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Scanner Status</h3>
            
            {scanResult && (
              <div className="flex items-start space-x-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-green-800">Scan Successful!</p>
                  <p className="text-sm text-green-700 mt-1 break-all">
                    Result: {scanResult}
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-red-800">Error Occurred</p>
                  <p className="text-sm text-red-700 mt-1">
                    {error}
                  </p>
                </div>
              </div>
            )}

            {!scanResult && !error && !showScanner && (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-gray-600">
                  Click &quot;Start Scanner&quot; to begin testing the QR scanner
                </p>
              </div>
            )}
          </div>

          {/* Scanner Section */}
          {showScanner && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">QR Scanner</h3>
              <QRScanner
                onScan={handleScan}
                onError={handleError}
              />
            </div>
          )}

          {/* Control Buttons */}
          <div className="flex gap-3">
            {!showScanner && !scanResult && (
              <Button
                onClick={() => setShowScanner(true)}
                className="flex-1"
              >
                Start Scanner
              </Button>
            )}

            {scanResult && (
              <>
                <Button
                  onClick={() => {
                    setScanResult(null)
                    setShowScanner(true)
                  }}
                  className="flex-1"
                >
                  Scan Again
                </Button>
                <Button
                  onClick={resetTest}
                  variant="outline"
                  className="flex-1"
                >
                  Reset Test
                </Button>
              </>
            )}

            {showScanner && (
              <Button
                onClick={() => setShowScanner(false)}
                variant="outline"
                className="w-full"
              >
                Cancel Scanning
              </Button>
            )}
          </div>

          {/* Test Information */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">Test Information</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Uses @yudiel/react-qr-scanner library</li>
              <li>• Optimized for mobile devices (iOS & Android)</li>
              <li>• Includes file upload fallback</li>
              <li>• Handles permissions properly</li>
              <li>• Clear error messages and UI feedback</li>
            </ul>
          </div>

          {/* Device Information */}
          <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h4 className="font-semibold text-gray-800 mb-2">Device Information</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p>• Browser: {typeof navigator !== 'undefined' ? navigator.userAgent.split(' ').slice(-2).join(' ') : 'Unknown'}</p>
              <p>• Secure Context: {typeof window !== 'undefined' && window.isSecureContext ? 'Yes' : 'No'}</p>
              <p>• Camera Support: {typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function' ? 'Yes' : 'No'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}