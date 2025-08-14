'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Database } from '@/types/supabase';
import { Bell, Mail, Smartphone, Clock, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface NotificationSettingsProps {
  profile: Profile;
  onUpdate: () => void;
}

interface NotificationPreferences {
  email: {
    schedule_changes: boolean;
    attendance_alerts: boolean;
    sales_reports: boolean;
    system_updates: boolean;
  };
  push: {
    schedule_changes: boolean;
    attendance_alerts: boolean;
    emergency_alerts: boolean;
  };
  quiet_hours: {
    enabled: boolean;
    start_time: string;
    end_time: string;
  };
}

export default function NotificationSettings({ profile, onUpdate }: NotificationSettingsProps) {
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email: {
      schedule_changes: true,
      attendance_alerts: true,
      sales_reports: false,
      system_updates: false
    },
    push: {
      schedule_changes: true,
      attendance_alerts: true,
      emergency_alerts: true
    },
    quiet_hours: {
      enabled: false,
      start_time: '22:00',
      end_time: '08:00'
    }
  });
  
  const supabase = createClient();

  useEffect(() => {
    fetchNotificationPreferences();
  }, [profile.id]);

  const fetchNotificationPreferences = async () => {
    // 실제 구현에서는 notification_preferences 테이블에서 가져옴
    // 현재는 기본값 사용
    console.log('Fetching notification preferences for user:', profile.id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 실제 구현에서는 notification_preferences 테이블에 저장
      console.log('Saving notification preferences:', preferences);
      
      alert('알림 설정이 저장되었습니다.');
      onUpdate();
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      alert('알림 설정 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailToggle = (key: keyof typeof preferences.email) => {
    setPreferences(prev => ({
      ...prev,
      email: {
        ...prev.email,
        [key]: !prev.email[key]
      }
    }));
  };

  const handlePushToggle = (key: keyof typeof preferences.push) => {
    setPreferences(prev => ({
      ...prev,
      push: {
        ...prev.push,
        [key]: !prev.push[key]
      }
    }));
  };

  const handleQuietHoursToggle = () => {
    setPreferences(prev => ({
      ...prev,
      quiet_hours: {
        ...prev.quiet_hours,
        enabled: !prev.quiet_hours.enabled
      }
    }));
  };

  const handleTimeChange = (type: 'start_time' | 'end_time', value: string) => {
    setPreferences(prev => ({
      ...prev,
      quiet_hours: {
        ...prev.quiet_hours,
        [type]: value
      }
    }));
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <Bell className="h-6 w-6 mr-2" />
          알림 설정
        </h2>
        <p className="mt-2 text-sm text-gray-800">
          중요한 업데이트와 알림을 받을 방법을 선택하세요.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* 이메일 알림 */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center mb-4">
            <Mail className="h-5 w-5 mr-2" />
            이메일 알림
          </h3>
          
          <div className="space-y-4">
            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
              <div className="flex-1">
                <p className="font-medium text-gray-900">스케줄 변경</p>
                <p className="text-sm text-gray-800">근무 스케줄이 변경될 때 알림</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.email.schedule_changes}
                onChange={() => handleEmailToggle('schedule_changes')}
                className="h-5 w-5 text-bagel-yellow focus:ring-bagel-yellow rounded"
              />
            </label>

            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
              <div className="flex-1">
                <p className="font-medium text-gray-900">출퇴근 알림</p>
                <p className="text-sm text-gray-800">출퇴근 누락 시 알림</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.email.attendance_alerts}
                onChange={() => handleEmailToggle('attendance_alerts')}
                className="h-5 w-5 text-bagel-yellow focus:ring-bagel-yellow rounded"
              />
            </label>

            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
              <div className="flex-1">
                <p className="font-medium text-gray-900">매출 리포트</p>
                <p className="text-sm text-gray-800">일일/주간 매출 요약 리포트</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.email.sales_reports}
                onChange={() => handleEmailToggle('sales_reports')}
                className="h-5 w-5 text-bagel-yellow focus:ring-bagel-yellow rounded"
              />
            </label>

            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
              <div className="flex-1">
                <p className="font-medium text-gray-900">시스템 업데이트</p>
                <p className="text-sm text-gray-800">새로운 기능 및 시스템 공지</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.email.system_updates}
                onChange={() => handleEmailToggle('system_updates')}
                className="h-5 w-5 text-bagel-yellow focus:ring-bagel-yellow rounded"
              />
            </label>
          </div>
        </div>

        {/* 푸시 알림 */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center mb-4">
            <Smartphone className="h-5 w-5 mr-2" />
            푸시 알림
          </h3>
          
          <div className="space-y-4">
            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
              <div className="flex-1">
                <p className="font-medium text-gray-900">스케줄 변경</p>
                <p className="text-sm text-gray-800">즉시 알림 받기</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.push.schedule_changes}
                onChange={() => handlePushToggle('schedule_changes')}
                className="h-5 w-5 text-bagel-yellow focus:ring-bagel-yellow rounded"
              />
            </label>

            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
              <div className="flex-1">
                <p className="font-medium text-gray-900">출퇴근 알림</p>
                <p className="text-sm text-gray-800">출퇴근 시간 리마인더</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.push.attendance_alerts}
                onChange={() => handlePushToggle('attendance_alerts')}
                className="h-5 w-5 text-bagel-yellow focus:ring-bagel-yellow rounded"
              />
            </label>

            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
              <div className="flex-1">
                <p className="font-medium text-gray-900">긴급 알림</p>
                <p className="text-sm text-gray-800">매장 긴급 상황 알림</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.push.emergency_alerts}
                onChange={() => handlePushToggle('emergency_alerts')}
                className="h-5 w-5 text-bagel-yellow focus:ring-bagel-yellow rounded"
              />
            </label>
          </div>
        </div>

        {/* 방해 금지 시간 */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center mb-4">
            <Clock className="h-5 w-5 mr-2" />
            방해 금지 시간
          </h3>
          
          <div className="p-4 bg-gray-50 rounded-lg">
            <label className="flex items-center justify-between mb-4 cursor-pointer">
              <div className="flex-1">
                <p className="font-medium text-gray-900">방해 금지 모드 사용</p>
                <p className="text-sm text-gray-800">설정된 시간 동안 알림을 받지 않습니다</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.quiet_hours.enabled}
                onChange={handleQuietHoursToggle}
                className="h-5 w-5 text-bagel-yellow focus:ring-bagel-yellow rounded"
              />
            </label>

            {preferences.quiet_hours.enabled && (
              <div className="flex items-center space-x-4 mt-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    시작 시간
                  </label>
                  <input
                    type="time"
                    value={preferences.quiet_hours.start_time}
                    onChange={(e) => handleTimeChange('start_time', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    종료 시간
                  </label>
                  <input
                    type="time"
                    value={preferences.quiet_hours.end_time}
                    onChange={(e) => handleTimeChange('end_time', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="pt-6 border-t border-gray-200">
          <Button
            type="submit"
            disabled={loading}
            className="bg-bagel-yellow hover:bg-yellow-600 text-black"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-black mr-2"></div>
                저장 중...
              </>
            ) : (
              <>
                <Bell className="h-5 w-5 mr-2" />
                알림 설정 저장
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}