'use client'

import { useEffect, useState } from 'react'
import QRCode from 'react-qr-code'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/supabase'
import CryptoJS from 'crypto-js'

interface StoreQRDisplayProps {
  storeId: string
  storeName?: string
  refreshInterval?: number // seconds
}

interface QRData {
  store_id: string
  timestamp: number
  token: string
  signature: string
}

export function StoreQRDisplay({ 
  storeId, 
  storeName = '매장',
  refreshInterval = 30 
}: StoreQRDisplayProps) {
  const [qrData, setQrData] = useState<string>('')
  const [nextRefresh, setNextRefresh] = useState(refreshInterval)
  const supabase = createClient()

  const generateTOTP = (secret: string, timestamp: number): string => {
    // 간단한 TOTP 구현 (실제로는 더 복잡한 알고리즘 필요)
    const timeSlot = Math.floor(timestamp / 30000)
    const hash = CryptoJS.HmacSHA256(timeSlot.toString(), secret)
    return hash.toString(CryptoJS.enc.Hex).substring(0, 6)
  }

  const generateQRData = async () => {
    try {
      // 매장 정보 가져오기
      const { data: store, error } = await supabase
        .from('stores')
        .select('qr_secret')
        .eq('id', storeId)
        .single()

      if (error || !store) {
        // Store info query failed
        return
      }

      const timestamp = Date.now()
      const token = generateTOTP(store.qr_secret, timestamp)
      
      const payload: QRData = {
        store_id: storeId,
        timestamp,
        token,
        signature: ''
      }

      // 서명 생성
      const message = JSON.stringify({
        store_id: payload.store_id,
        timestamp: payload.timestamp,
        token: payload.token
      })
      
      payload.signature = CryptoJS.HmacSHA256(message, store.qr_secret)
        .toString(CryptoJS.enc.Hex)

      // 암호화
      const encrypted = CryptoJS.AES.encrypt(
        JSON.stringify(payload),
        store.qr_secret
      ).toString()

      setQrData(encrypted)
      setNextRefresh(refreshInterval)
    } catch (error) {
      // QR code generation failed
    }
  }

  useEffect(() => {
    generateQRData()
    
    const interval = setInterval(() => {
      generateQRData()
    }, refreshInterval * 1000)

    const countdown = setInterval(() => {
      setNextRefresh((prev) => (prev > 0 ? prev - 1 : refreshInterval))
    }, 1000)

    return () => {
      clearInterval(interval)
      clearInterval(countdown)
    }
  }, [storeId, refreshInterval])

  return (
    <div className="bg-white p-8 rounded-lg shadow-lg max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-center mb-6">
        {storeName} 출퇴근 QR 코드
      </h2>

      <div className="bg-gray-50 p-8 rounded-lg">
        {qrData ? (
          <QRCode
            value={qrData}
            size={256}
            className="w-full h-auto"
            level="H"
          />
        ) : (
          <div className="w-64 h-64 bg-gray-200 animate-pulse rounded" />
        )}
      </div>

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
          자동 갱신까지: <span className="font-mono font-bold">{nextRefresh}초</span>
        </p>
        <p className="text-xs text-gray-500 mt-2">
          이 QR 코드는 보안을 위해 {refreshInterval}초마다 자동으로 갱신됩니다
        </p>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="font-semibold mb-2">사용 방법</h3>
        <ol className="text-sm text-gray-600 space-y-1">
          <li>1. 직원이 모바일 앱을 실행합니다</li>
          <li>2. QR 스캔 버튼을 누릅니다</li>
          <li>3. 이 QR 코드를 스캔합니다</li>
          <li>4. 출퇴근이 자동으로 기록됩니다</li>
        </ol>
      </div>
    </div>
  )
}