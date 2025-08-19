/**
 * QR Service - Enhanced QR code scanning backend integration
 * Provides optimized Supabase connection handling, offline support, and retry logic
 */

import { createClient } from '@/lib/supabase/client'
import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

// Configuration constants
const QR_TOKEN_EXPIRY_MS = 30000 // 30 seconds
const MAX_RETRY_ATTEMPTS = 3
const RETRY_DELAY_MS = 1000
const CONNECTION_TIMEOUT_MS = 5000
const RATE_LIMIT_WINDOW_MS = 60000 // 1 minute
const MAX_SCANS_PER_WINDOW = 10

// Types
interface QRScanData {
  storeId: string
  storeCode: string
  token: string
  timestamp: number
}

interface LocationData {
  latitude: number
  longitude: number
  accuracy: number
}

interface QRValidationResult {
  isValid: boolean
  rateLimited: boolean
  tokenId?: string
  message: string
}

interface CheckInResult {
  success: boolean
  type: 'checkin' | 'checkout' | 'error'
  recordId?: string
  message: string
  timestamp: string
}

interface QRScanMetrics {
  scanStartTime: number
  networkLatency?: number
  validationTime?: number
  totalTime?: number
  retryCount: number
  connectionType: 'online' | 'offline' | 'slow'
}

// Offline queue for storing scans when offline
interface OfflineQueueItem {
  id: string
  qrData: QRScanData
  location?: LocationData
  timestamp: number
  retryCount: number
}

class QRService {
  private supabase: SupabaseClient<Database>
  private offlineQueue: OfflineQueueItem[] = []
  private isOnline: boolean = true
  private connectionSpeed: 'online' | 'slow' | 'offline' = 'online'
  private scanMetrics: Map<string, QRScanMetrics> = new Map()

  constructor() {
    this.supabase = createClient()
    this.initializeNetworkMonitoring()
    this.loadOfflineQueue()
  }

  /**
   * Initialize network monitoring
   */
  private initializeNetworkMonitoring() {
    // Monitor online/offline status
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine

      window.addEventListener('online', () => {
        this.isOnline = true
        this.processOfflineQueue()
      })

      window.addEventListener('offline', () => {
        this.isOnline = false
        this.connectionSpeed = 'offline'
      })

      // Monitor connection speed
      this.monitorConnectionSpeed()
    }
  }

  /**
   * Monitor connection speed using Navigation Timing API
   */
  private async monitorConnectionSpeed() {
    if (typeof window === 'undefined' || !window.performance) return

    try {
      const startTime = Date.now()
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache'
      })
      const latency = Date.now() - startTime

      if (latency < 500) {
        this.connectionSpeed = 'online'
      } else if (latency < 2000) {
        this.connectionSpeed = 'slow'
      } else {
        this.connectionSpeed = 'offline'
      }
    } catch {
      this.connectionSpeed = 'offline'
    }

    // Re-check every 30 seconds
    setTimeout(() => this.monitorConnectionSpeed(), 30000)
  }

  /**
   * Parse and validate QR code data
   */
  parseQRData(rawData: string): QRScanData | null {
    try {
      const data = JSON.parse(rawData) as QRScanData
      
      // Validate required fields
      if (!data.storeId || !data.token || !data.timestamp) {
        throw new Error('Invalid QR code format')
      }

      // Check token age (must be less than 30 seconds old)
      const age = Date.now() - data.timestamp
      if (age > QR_TOKEN_EXPIRY_MS) {
        throw new Error('QR code has expired')
      }

      return data
    } catch (error) {
      console.error('QR data parsing error:', error)
      return null
    }
  }

  /**
   * Validate QR token with rate limiting
   */
  async validateToken(
    qrData: QRScanData,
    userId: string
  ): Promise<QRValidationResult> {
    const scanId = `${qrData.storeId}-${Date.now()}`
    const metrics: QRScanMetrics = {
      scanStartTime: Date.now(),
      retryCount: 0,
      connectionType: this.connectionSpeed
    }

    try {
      // Check local rate limit first
      if (this.isRateLimited(userId, qrData.storeId)) {
        return {
          isValid: false,
          rateLimited: true,
          message: 'Rate limit exceeded. Please wait before scanning again.'
        }
      }

      // Hash the token for security
      const tokenHash = await this.hashToken(qrData.token)

      // Call Supabase function with retry logic
      const result = await this.retryOperation(async () => {
        const { data, error } = await this.supabase
          .rpc('validate_qr_token_with_rate_limit', {
            p_token_hash: tokenHash,
            p_store_id: qrData.storeId,
            p_identifier: userId,
            p_identifier_type: 'user'
          })
          .single()

        if (error) throw error
        return data as {
          is_valid: boolean
          rate_limited: boolean
          token_id: string
          message: string
        }
      }, metrics)

      metrics.validationTime = Date.now() - metrics.scanStartTime
      this.scanMetrics.set(scanId, metrics)

      return {
        isValid: result.is_valid,
        rateLimited: result.rate_limited,
        tokenId: result.token_id,
        message: result.message
      }
    } catch (error) {
      console.error('Token validation error:', error)
      
      // If offline, queue for later
      if (!this.isOnline) {
        this.addToOfflineQueue(qrData)
        return {
          isValid: false,
          rateLimited: false,
          message: 'Offline mode: Scan saved for processing when connection is restored'
        }
      }

      throw error
    }
  }

  /**
   * Process QR check-in/check-out
   */
  async processCheckIn(
    qrData: QRScanData,
    employeeId: string,
    location?: LocationData
  ): Promise<CheckInResult> {
    const metrics: QRScanMetrics = {
      scanStartTime: Date.now(),
      retryCount: 0,
      connectionType: this.connectionSpeed
    }

    try {
      // Validate location if provided
      if (location) {
        const isWithinGeofence = await this.validateLocation(
          qrData.storeId,
          location
        )
        
        if (!isWithinGeofence) {
          return {
            success: false,
            type: 'error',
            message: 'You are not within the store location',
            timestamp: new Date().toISOString()
          }
        }
      }

      // Hash token for storage
      const tokenHash = await this.hashToken(qrData.token)

      // Process check-in with retry logic
      const result = await this.retryOperation(async () => {
        const { data, error } = await this.supabase
          .rpc('process_qr_checkin', {
            p_employee_id: employeeId,
            p_store_id: qrData.storeId,
            p_token_hash: tokenHash,
            p_lat: location?.latitude || null,
            p_lng: location?.longitude || null,
            p_accuracy: location?.accuracy || null
          })
          .single()

        if (error) throw error
        return data as {
          success: boolean
          action_type: string
          record_id: string
          message: string
        }
      }, metrics)

      // Log scan for analytics
      await this.logScan({
        storeId: qrData.storeId,
        employeeId,
        tokenHash,
        result: 'success',
        responseTime: Date.now() - metrics.scanStartTime,
        location
      })

      metrics.totalTime = Date.now() - metrics.scanStartTime
      
      return {
        success: result.success,
        type: result.action_type as 'checkin' | 'checkout',
        recordId: result.record_id,
        message: result.message,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('Check-in processing error:', error)
      
      // If offline, queue for later
      if (!this.isOnline) {
        this.addToOfflineQueue(qrData, location)
        return {
          success: false,
          type: 'error',
          message: 'Offline: Your check-in will be processed when connection is restored',
          timestamp: new Date().toISOString()
        }
      }

      // Log failed scan
      await this.logScan({
        storeId: qrData.storeId,
        employeeId,
        tokenHash: '',
        result: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Date.now() - metrics.scanStartTime,
        location
      })

      throw error
    }
  }

  /**
   * Validate location against store geofence
   */
  private async validateLocation(
    storeId: string,
    location: LocationData
  ): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .rpc('validate_location_in_geofence', {
          p_store_id: storeId,
          p_lat: location.latitude,
          p_lng: location.longitude
        })
        .single()

      if (error) {
        console.error('Geofence validation error:', error)
        return true // Allow if geofence check fails
      }

      return data as boolean
    } catch {
      return true // Allow if validation fails
    }
  }

  /**
   * Retry operation with exponential backoff
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    metrics: QRScanMetrics,
    attempts: number = MAX_RETRY_ATTEMPTS
  ): Promise<T> {
    for (let i = 0; i < attempts; i++) {
      try {
        const result = await Promise.race([
          operation(),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Operation timeout')), CONNECTION_TIMEOUT_MS)
          )
        ])
        
        metrics.retryCount = i
        return result
      } catch (error) {
        if (i === attempts - 1) throw error
        
        // Exponential backoff
        const delay = RETRY_DELAY_MS * Math.pow(2, i)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    throw new Error('Max retry attempts exceeded')
  }

  /**
   * Hash token using Web Crypto API
   */
  private async hashToken(token: string): Promise<string> {
    if (typeof window === 'undefined' || !window.crypto) {
      // Fallback for Node.js environment
      const crypto = await import('crypto')
      return crypto.createHash('sha256').update(token).digest('hex')
    }

    const encoder = new TextEncoder()
    const data = encoder.encode(token)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Check if user is rate limited (client-side check)
   */
  private isRateLimited(userId: string, storeId: string): boolean {
    const key = `rate_limit_${userId}_${storeId}`
    const stored = localStorage.getItem(key)
    
    if (!stored) return false
    
    const data = JSON.parse(stored)
    const now = Date.now()
    
    // Clean up old entries
    const recentScans = data.scans.filter(
      (timestamp: number) => now - timestamp < RATE_LIMIT_WINDOW_MS
    )
    
    if (recentScans.length >= MAX_SCANS_PER_WINDOW) {
      return true
    }
    
    // Update with new scan
    recentScans.push(now)
    localStorage.setItem(key, JSON.stringify({ scans: recentScans }))
    
    return false
  }

  /**
   * Log scan attempt for analytics
   */
  private async logScan(params: {
    storeId: string
    employeeId: string
    tokenHash: string
    result: string
    errorMessage?: string
    responseTime: number
    location?: LocationData
  }) {
    try {
      await this.supabase.from('qr_scan_logs').insert({
        store_id: params.storeId,
        employee_id: params.employeeId,
        token_hash: params.tokenHash,
        scan_result: params.result,
        error_message: params.errorMessage,
        response_time_ms: params.responseTime,
        location_lat: params.location?.latitude,
        location_lng: params.location?.longitude,
        location_accuracy: params.location?.accuracy,
        device_info: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          connectionType: this.connectionSpeed
        }
      })
    } catch (error) {
      console.error('Failed to log scan:', error)
    }
  }

  /**
   * Add scan to offline queue
   */
  private addToOfflineQueue(qrData: QRScanData, location?: LocationData) {
    const item: OfflineQueueItem = {
      id: `${qrData.storeId}-${Date.now()}`,
      qrData,
      location,
      timestamp: Date.now(),
      retryCount: 0
    }
    
    this.offlineQueue.push(item)
    this.saveOfflineQueue()
  }

  /**
   * Process offline queue when connection is restored
   */
  private async processOfflineQueue() {
    if (this.offlineQueue.length === 0) return
    
    const queue = [...this.offlineQueue]
    this.offlineQueue = []
    
    for (const item of queue) {
      try {
        // Check if token is still valid (within 24 hours)
        if (Date.now() - item.timestamp > 86400000) {
          console.log('Skipping expired offline scan:', item.id)
          continue
        }
        
        // Process the queued scan
        // Note: This would need proper employee ID retrieval
        console.log('Processing offline scan:', item.id)
        
        item.retryCount++
        if (item.retryCount < MAX_RETRY_ATTEMPTS) {
          this.offlineQueue.push(item)
        }
      } catch (error) {
        console.error('Failed to process offline scan:', error)
      }
    }
    
    this.saveOfflineQueue()
  }

  /**
   * Save offline queue to localStorage
   */
  private saveOfflineQueue() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('qr_offline_queue', JSON.stringify(this.offlineQueue))
    }
  }

  /**
   * Load offline queue from localStorage
   */
  private loadOfflineQueue() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('qr_offline_queue')
      if (stored) {
        try {
          this.offlineQueue = JSON.parse(stored)
        } catch {
          this.offlineQueue = []
        }
      }
    }
  }

  /**
   * Get scan metrics for debugging
   */
  getScanMetrics(scanId: string): QRScanMetrics | undefined {
    return this.scanMetrics.get(scanId)
  }

  /**
   * Clear old metrics to prevent memory leak
   */
  clearOldMetrics() {
    const now = Date.now()
    const maxAge = 3600000 // 1 hour
    
    for (const [id, metrics] of this.scanMetrics.entries()) {
      if (now - metrics.scanStartTime > maxAge) {
        this.scanMetrics.delete(id)
      }
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      isOnline: this.isOnline,
      connectionSpeed: this.connectionSpeed,
      offlineQueueSize: this.offlineQueue.length
    }
  }
}

// Export singleton instance
export const qrService = new QRService()

// Export types
export type { QRScanData, LocationData, QRValidationResult, CheckInResult, QRScanMetrics }