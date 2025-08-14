'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { QrCode, Clock, Calendar, CheckCircle2, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

interface AttendanceRecord {
  id: string
  check_in_time: string
  check_out_time: string | null
  date: string
  status: string
}

export default function AttendancePage() {
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null)
  const [recentRecords, setRecentRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchAttendanceData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // 오늘의 출퇴근 기록
        const today = new Date().toISOString().split('T')[0]
        const { data: todayData } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('employee_id', user.id)
          .eq('date', today)
          .single()

        if (todayData) {
          setTodayAttendance(todayData)
        }

        // 최근 7일 기록
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        
        const { data: recentData } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('employee_id', user.id)
          .gte('date', sevenDaysAgo.toISOString().split('T')[0])
          .order('date', { ascending: false })
          .limit(7)

        if (recentData) {
          setRecentRecords(recentData)
        }
      } catch (error) {
        console.error('Error fetching attendance data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAttendanceData()
  }, [supabase])


  const formatTime = (timeString: string) => {
    return format(new Date(timeString), 'HH:mm', { locale: ko })
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'M월 d일 (EEE)', { locale: ko })
  }

  return (
    <div className="container mx-auto px-4 py-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">출퇴근 관리</h1>
        <p className="text-sm sm:text-base text-gray-800 mt-1">QR 코드로 간편하게 출퇴근을 기록하세요</p>
      </div>

      {/* QR 스캔 버튼 */}
      <Card className="mb-4 sm:mb-6 shadow-md">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-lg sm:text-xl">QR 체크인/체크아웃</CardTitle>
          <CardDescription className="text-xs sm:text-sm mt-1">
            매장의 QR 코드를 스캔하여 출퇴근을 기록합니다
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
          <Link href="/attendance/scan">
            <Button size="lg" className="w-full bg-bagel-yellow hover:bg-bagel-yellow-600 text-bagel-black text-sm sm:text-base">
              <QrCode className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              QR 코드 스캔하기
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* 오늘의 출퇴근 현황 */}
      <Card className="mb-4 sm:mb-6 shadow-md">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-lg sm:text-xl">오늘의 출퇴근</CardTitle>
          <CardDescription className="text-xs sm:text-sm mt-1">
            {format(new Date(), 'yyyy년 MM월 dd일 EEEE', { locale: ko })}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
          {loading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : todayAttendance ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                  <span className="text-sm sm:text-base font-medium">출근</span>
                </div>
                <span className="text-base sm:text-lg">{formatTime(todayAttendance.check_in_time)}</span>
              </div>
              
              {todayAttendance.check_out_time ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                    <span className="text-sm sm:text-base font-medium">퇴근</span>
                  </div>
                  <span className="text-base sm:text-lg">{formatTime(todayAttendance.check_out_time)}</span>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-gray-800" />
                    <span className="text-sm sm:text-base font-medium text-gray-800">퇴근</span>
                  </div>
                  <span className="text-sm sm:text-base text-gray-800">미등록</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 sm:py-8 text-gray-700">
              <XCircle className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 text-gray-300" />
              <p className="text-sm sm:text-base">오늘은 아직 출근하지 않았습니다</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 최근 출퇴근 기록 */}
      <Card className="shadow-md">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-lg sm:text-xl">최근 출퇴근 기록</CardTitle>
          <CardDescription className="text-xs sm:text-sm mt-1">최근 7일간의 출퇴근 기록입니다</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
          {loading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : recentRecords.length > 0 ? (
            <div className="space-y-3">
              {recentRecords.map((record) => (
                <div key={record.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 border-b last:border-0">
                  <div className="flex items-center space-x-2 sm:space-x-3 mb-2 sm:mb-0">
                    <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-gray-800" />
                    <span className="text-sm sm:text-base font-medium">{formatDate(record.date)}</span>
                  </div>
                  <div className="flex items-center space-x-3 sm:space-x-4 text-xs sm:text-sm ml-5 sm:ml-0">
                    <span className="text-green-600">
                      출근 {formatTime(record.check_in_time)}
                    </span>
                    {record.check_out_time ? (
                      <span className="text-blue-600">
                        퇴근 {formatTime(record.check_out_time)}
                      </span>
                    ) : (
                      <span className="text-gray-800">퇴근 미등록</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 sm:py-8 text-gray-700">
              <p className="text-sm sm:text-base">최근 출퇴근 기록이 없습니다</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}