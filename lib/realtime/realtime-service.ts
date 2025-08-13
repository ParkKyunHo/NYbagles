/**
 * Supabase Realtime 서비스
 * 실시간 데이터 동기화 및 알림 시스템
 */

import { createClient } from '@/lib/supabase/client'
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE'
export type RealtimeTable = 'sales' | 'products' | 'employees' | 'attendance' | 'notifications'

interface RealtimeConfig {
  table: RealtimeTable
  event?: RealtimeEvent | RealtimeEvent[]
  filter?: string
  callback: (payload: any) => void
}

class RealtimeService {
  private channels: Map<string, RealtimeChannel> = new Map()
  private supabase: ReturnType<typeof createClient> | null = null

  async initialize() {
    if (!this.supabase) {
      this.supabase = createClient()
    }
    return this.supabase
  }

  /**
   * 테이블 변경사항 구독
   */
  async subscribe(config: RealtimeConfig): Promise<string> {
    const client = await this.initialize()
    const channelId = `${config.table}-${Date.now()}`
    
    const events = Array.isArray(config.event) 
      ? config.event 
      : config.event 
        ? [config.event] 
        : ['INSERT', 'UPDATE', 'DELETE']

    const channel = client.channel(channelId)

    events.forEach(event => {
      const postgresChanges = {
        event,
        schema: 'public',
        table: config.table,
        ...(config.filter && { filter: config.filter })
      }

      channel.on(
        'postgres_changes' as any,
        postgresChanges,
        (payload: RealtimePostgresChangesPayload<any>) => {
          console.log(`[Realtime] ${event} on ${config.table}:`, payload)
          config.callback(payload)
        }
      )
    })

    channel.subscribe((status) => {
      console.log(`[Realtime] Channel ${channelId} status:`, status)
    })

    this.channels.set(channelId, channel)
    return channelId
  }

  /**
   * 구독 해제
   */
  async unsubscribe(channelId: string) {
    const channel = this.channels.get(channelId)
    if (channel) {
      await channel.unsubscribe()
      this.channels.delete(channelId)
      console.log(`[Realtime] Unsubscribed from channel: ${channelId}`)
    }
  }

  /**
   * 모든 구독 해제
   */
  async unsubscribeAll() {
    for (const [channelId, channel] of this.channels.entries()) {
      await channel.unsubscribe()
    }
    this.channels.clear()
    console.log('[Realtime] All channels unsubscribed')
  }

  /**
   * 판매 실시간 업데이트 구독
   */
  subscribeSales(orgId: string, callback: (data: any) => void) {
    return this.subscribe({
      table: 'sales',
      event: ['INSERT', 'UPDATE'],
      filter: `org_id=eq.${orgId}`,
      callback: (payload) => {
        if (payload.eventType === 'INSERT') {
          callback({ type: 'new_sale', data: payload.new })
        } else if (payload.eventType === 'UPDATE') {
          callback({ type: 'sale_updated', data: payload.new })
        }
      }
    })
  }

  /**
   * 재고 실시간 업데이트 구독
   */
  subscribeInventory(storeId: string, callback: (data: any) => void) {
    return this.subscribe({
      table: 'products',
      event: 'UPDATE',
      filter: `store_id=eq.${storeId}`,
      callback: (payload) => {
        callback({ 
          type: 'inventory_updated', 
          productId: payload.new.id,
          oldStock: payload.old.stock,
          newStock: payload.new.stock 
        })
      }
    })
  }

  /**
   * 직원 출퇴근 실시간 업데이트 구독
   */
  subscribeAttendance(orgId: string, callback: (data: any) => void) {
    return this.subscribe({
      table: 'attendance',
      event: 'INSERT',
      filter: `org_id=eq.${orgId}`,
      callback: (payload) => {
        callback({ 
          type: payload.new.type === 'checkin' ? 'employee_checkin' : 'employee_checkout',
          employeeId: payload.new.employee_id,
          timestamp: payload.new.created_at
        })
      }
    })
  }

  /**
   * 알림 실시간 구독
   */
  subscribeNotifications(userId: string, callback: (notification: any) => void) {
    return this.subscribe({
      table: 'notifications',
      event: 'INSERT',
      filter: `user_id=eq.${userId}`,
      callback: (payload) => {
        callback(payload.new)
      }
    })
  }
}

// 싱글톤 인스턴스
export const realtimeService = new RealtimeService()

// React Hook for Realtime
import { useState, useEffect } from 'react'

export function useRealtime(config: RealtimeConfig) {
  const [channelId, setChannelId] = useState<string | null>(null)

  useEffect(() => {
    let id: string | null = null

    const setup = async () => {
      id = await realtimeService.subscribe(config)
      setChannelId(id)
    }

    setup()

    return () => {
      if (id) {
        realtimeService.unsubscribe(id)
      }
    }
  }, [config.table, config.filter])

  return channelId
}