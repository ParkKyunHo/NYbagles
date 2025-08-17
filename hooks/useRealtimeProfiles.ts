'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'

interface Profile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  role: string
  store_id: string | null
}

export function useRealtimeProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const supabase = createClient()

  useEffect(() => {
    let channel: RealtimeChannel

    const setupRealtimeSubscription = () => {
      // profiles 테이블의 실시간 변경사항 구독
      channel = supabase
        .channel('profiles-changes')
        .on(
          'postgres_changes',
          {
            event: '*', // INSERT, UPDATE, DELETE 모두 감지
            schema: 'public',
            table: 'profiles'
          },
          (payload) => {
            console.log('Profile change received:', payload)
            
            // 변경 타입에 따라 처리
            if (payload.eventType === 'INSERT') {
              setProfiles(prev => [...prev, payload.new as Profile])
            } else if (payload.eventType === 'UPDATE') {
              setProfiles(prev => 
                prev.map(profile => 
                  profile.id === payload.new.id 
                    ? payload.new as Profile 
                    : profile
                )
              )
            } else if (payload.eventType === 'DELETE') {
              setProfiles(prev => 
                prev.filter(profile => profile.id !== payload.old.id)
              )
            }
            
            setLastUpdate(new Date())
          }
        )
        .subscribe((status) => {
          console.log('Realtime subscription status:', status)
        })
    }

    setupRealtimeSubscription()

    // Cleanup on unmount
    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [supabase])

  return { profiles, lastUpdate }
}

// 직원 프로필 업데이트 알림을 위한 훅
export function useProfileUpdateNotification() {
  const [notification, setNotification] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    let channel: RealtimeChannel

    channel = supabase
      .channel('profile-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          const { full_name, phone } = payload.new
          const { phone: oldPhone } = payload.old
          
          // 연락처가 변경된 경우 알림
          if (phone !== oldPhone) {
            setNotification(`${full_name || '직원'}님의 연락처가 ${phone || '없음'}으로 변경되었습니다.`)
            
            // 5초 후 알림 제거
            setTimeout(() => {
              setNotification(null)
            }, 5000)
          }
        }
      )
      .subscribe()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [supabase])

  return notification
}