'use client'

import { useState, useCallback } from 'react'
import { QRScanner } from '@/components/qr/QRScanner'
import { MobileSalesCard } from '@/components/sales/MobileSalesCard'
import { Button } from '@/components/ui/button'
import { ArrowLeft, RefreshCw } from 'lucide-react'

interface SalesData {
  store: {
    id: string
    name: string
    code: string
    address?: string
  }
  current_month: {
    total: number
    count: number
    average_transaction: number
    period: string
  }
  previous_month: {
    total: number
    count: number
    period: string
  }
  comparison: {
    change_amount: number
    change_percentage: number
    is_increase: boolean
  }
  today: {
    total: number
    count: number
  }
  trend: Array<{
    month: string
    total: number
    count: number
  }>
  generated_at: string
}

/**
 * QR Sales Scanner Component
 * Handles QR code scanning and sales data display for admin users
 * Optimized for mobile devices with iOS-specific fixes
 */
export function QRSalesScanner() {
  const [isScanning, setIsScanning] = useState(true)
  const [salesData, setSalesData] = useState<SalesData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleScan = useCallback(async (data: string) => {
    try {
      setLoading(true)
      setError(null)
      
      // Parse QR code data - expect store UUID
      let storeId: string
      
      try {
        // Try to parse as JSON first (if QR contains more data)
        const parsed = JSON.parse(data)
        storeId = parsed.store_id || parsed.id || parsed.storeId
      } catch {
        // If not JSON, treat as direct store ID
        storeId = data.trim()
      }

      // Validate UUID format
      if (!storeId || !storeId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
        throw new Error('유효하지 않은 매장 QR 코드입니다.')
      }

      // Fetch sales data
      const response = await fetch(`/api/stores/${storeId}/sales?month=current`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '매출 데이터를 불러올 수 없습니다.')
      }

      if (!result.success || !result.data) {
        throw new Error('매출 데이터가 없습니다.')
      }

      setSalesData(result.data)
      setIsScanning(false)

    } catch (err) {
      console.error('QR scan error:', err)
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleScanError = useCallback((error: Error) => {
    console.error('Scanner error:', error)
    setError('QR 코드 스캔 중 오류가 발생했습니다: ' + error.message)
  }, [])

  const resetScanner = useCallback(() => {
    setSalesData(null)
    setError(null)
    setIsScanning(true)
  }, [])

  const refreshData = useCallback(async () => {
    if (!salesData?.store?.id) return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/stores/${salesData.store.id}/sales?month=current`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '데이터 새로고침 실패')
      }

      if (result.success && result.data) {
        setSalesData(result.data)
      }
    } catch (err) {
      console.error('Data refresh error:', err)
      setError(err instanceof Error ? err.message : '데이터 새로고침 실패')
    } finally {
      setLoading(false)
    }
  }, [salesData?.store?.id])

  // Loading state overlay
  if (loading) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-bagel-yellow mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">매출 데이터 로딩 중</h3>
          <p className="text-gray-600 text-sm">잠시만 기다려주세요...</p>
        </div>
      </div>
    )
  }

  // Sales data display
  if (salesData) {
    return (
      <div className="w-full max-w-md mx-auto space-y-4">
        {/* Sales data card */}
        <MobileSalesCard 
          salesData={salesData} 
          onRefresh={refreshData}
          loading={loading}
        />

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button
            onClick={resetScanner}
            variant="outline"
            className="flex-1 min-h-[44px] touch-manipulation"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            다른 매장 스캔
          </Button>
          
          <Button
            onClick={refreshData}
            variant="outline"
            disabled={loading}
            className="min-h-[44px] touch-manipulation"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="w-full max-w-md mx-auto space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold mb-2">오류 발생</h3>
          <p className="text-red-700 text-sm mb-4">{error}</p>
          <Button
            onClick={() => {
              setError(null)
              setIsScanning(true)
            }}
            variant="outline"
            size="sm"
            className="w-full"
          >
            다시 시도
          </Button>
        </div>
      </div>
    )
  }

  // QR Scanner state
  if (isScanning) {
    return (
      <div className="w-full max-w-md mx-auto">
        <QRScanner
          onScan={handleScan}
          onError={handleScanError}
        />
        
        {/* Additional scanning tips */}
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-blue-800 font-semibold text-sm mb-2">스캔 팁</h4>
          <ul className="text-blue-700 text-xs space-y-1">
            <li>• QR 코드를 화면 중앙의 박스 안에 맞춰주세요</li>
            <li>• 충분한 조명이 있는 곳에서 스캔하세요</li>
            <li>• QR 코드가 선명하게 보이도록 거리를 조절하세요</li>
            <li>• 스마트폰을 안정적으로 고정해주세요</li>
          </ul>
        </div>
      </div>
    )
  }

  return null
}