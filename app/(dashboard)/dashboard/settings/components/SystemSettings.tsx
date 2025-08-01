'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Database } from '@/types/supabase';
import { Settings2, Store, Clock, Users, ShieldCheck, Database as DatabaseIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface SystemSettingsProps {
  profile: Profile;
  onUpdate: () => void;
}

interface SystemConfig {
  attendance: {
    late_threshold_minutes: number;
    early_leave_threshold_minutes: number;
    max_work_hours_per_day: number;
    overtime_threshold_hours: number;
  };
  schedule: {
    min_hours_between_shifts: number;
    max_consecutive_days: number;
    schedule_lock_days: number;
  };
  sales: {
    allow_negative_stock: boolean;
    require_manager_approval_amount: number;
    daily_cash_limit: number;
  };
  security: {
    password_expiry_days: number;
    max_login_attempts: number;
    session_timeout_minutes: number;
    require_2fa: boolean;
  };
}

export default function SystemSettings({ profile, onUpdate }: SystemSettingsProps) {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<SystemConfig>({
    attendance: {
      late_threshold_minutes: 10,
      early_leave_threshold_minutes: 10,
      max_work_hours_per_day: 12,
      overtime_threshold_hours: 8
    },
    schedule: {
      min_hours_between_shifts: 8,
      max_consecutive_days: 6,
      schedule_lock_days: 3
    },
    sales: {
      allow_negative_stock: false,
      require_manager_approval_amount: 100000,
      daily_cash_limit: 1000000
    },
    security: {
      password_expiry_days: 90,
      max_login_attempts: 5,
      session_timeout_minutes: 30,
      require_2fa: false
    }
  });
  
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 실제 구현에서는 system_config 테이블에 저장
      console.log('Saving system configuration:', config);
      
      alert('시스템 설정이 저장되었습니다.');
      onUpdate();
    } catch (error) {
      console.error('Error saving system configuration:', error);
      alert('시스템 설정 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleNumberChange = (
    section: keyof SystemConfig,
    field: string,
    value: string
  ) => {
    const numValue = parseInt(value) || 0;
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: numValue
      }
    }));
  };

  const handleBooleanChange = (
    section: keyof SystemConfig,
    field: string
  ) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: !prev[section][field as keyof typeof prev[typeof section]]
      }
    }));
  };

  if (!['super_admin', 'admin'].includes(profile.role)) {
    return (
      <div className="text-center py-12">
        <ShieldCheck className="h-12 w-12 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-700">시스템 설정은 관리자만 접근 가능합니다.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <Settings2 className="h-6 w-6 mr-2" />
          시스템 설정
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          전체 시스템의 운영 정책과 기본값을 설정합니다.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* 출퇴근 설정 */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center mb-4">
            <Clock className="h-5 w-5 mr-2" />
            출퇴근 관리
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                지각 판정 시간 (분)
              </label>
              <input
                type="number"
                value={config.attendance.late_threshold_minutes}
                onChange={(e) => handleNumberChange('attendance', 'late_threshold_minutes', e.target.value)}
                min="0"
                max="60"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-700">
                출근 예정 시간보다 몇 분 늦으면 지각으로 처리할지 설정
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                조퇴 판정 시간 (분)
              </label>
              <input
                type="number"
                value={config.attendance.early_leave_threshold_minutes}
                onChange={(e) => handleNumberChange('attendance', 'early_leave_threshold_minutes', e.target.value)}
                min="0"
                max="60"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-700">
                퇴근 예정 시간보다 몇 분 일찍 퇴근하면 조퇴로 처리할지 설정
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                일일 최대 근무 시간
              </label>
              <input
                type="number"
                value={config.attendance.max_work_hours_per_day}
                onChange={(e) => handleNumberChange('attendance', 'max_work_hours_per_day', e.target.value)}
                min="8"
                max="24"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                초과 근무 기준 시간
              </label>
              <input
                type="number"
                value={config.attendance.overtime_threshold_hours}
                onChange={(e) => handleNumberChange('attendance', 'overtime_threshold_hours', e.target.value)}
                min="4"
                max="12"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* 스케줄 설정 */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center mb-4">
            <Users className="h-5 w-5 mr-2" />
            스케줄 관리
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                교대 간 최소 휴식 시간
              </label>
              <input
                type="number"
                value={config.schedule.min_hours_between_shifts}
                onChange={(e) => handleNumberChange('schedule', 'min_hours_between_shifts', e.target.value)}
                min="4"
                max="24"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-700">시간 단위</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                최대 연속 근무일
              </label>
              <input
                type="number"
                value={config.schedule.max_consecutive_days}
                onChange={(e) => handleNumberChange('schedule', 'max_consecutive_days', e.target.value)}
                min="1"
                max="14"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                스케줄 잠금 기간
              </label>
              <input
                type="number"
                value={config.schedule.schedule_lock_days}
                onChange={(e) => handleNumberChange('schedule', 'schedule_lock_days', e.target.value)}
                min="0"
                max="30"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-700">
                며칠 전부터 스케줄 변경을 제한할지 설정
              </p>
            </div>
          </div>
        </div>

        {/* 판매 설정 */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center mb-4">
            <Store className="h-5 w-5 mr-2" />
            판매 관리
          </h3>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-medium text-gray-900">음수 재고 허용</p>
                <p className="text-sm text-gray-600 mt-1">
                  재고가 부족해도 판매를 허용할지 설정
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.sales.allow_negative_stock}
                onChange={() => handleBooleanChange('sales', 'allow_negative_stock')}
                className="h-5 w-5 text-bagel-yellow focus:ring-bagel-yellow rounded"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  매니저 승인 필요 금액
                </label>
                <input
                  type="number"
                  value={config.sales.require_manager_approval_amount}
                  onChange={(e) => handleNumberChange('sales', 'require_manager_approval_amount', e.target.value)}
                  min="0"
                  step="10000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-700">원 단위</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  일일 현금 한도
                </label>
                <input
                  type="number"
                  value={config.sales.daily_cash_limit}
                  onChange={(e) => handleNumberChange('sales', 'daily_cash_limit', e.target.value)}
                  min="0"
                  step="100000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-700">원 단위</p>
              </div>
            </div>
          </div>
        </div>

        {/* 보안 설정 */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center mb-4">
            <ShieldCheck className="h-5 w-5 mr-2" />
            보안 정책
          </h3>
          
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  비밀번호 만료 기간
                </label>
                <input
                  type="number"
                  value={config.security.password_expiry_days}
                  onChange={(e) => handleNumberChange('security', 'password_expiry_days', e.target.value)}
                  min="0"
                  max="365"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-700">일 단위 (0은 만료 없음)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  최대 로그인 시도 횟수
                </label>
                <input
                  type="number"
                  value={config.security.max_login_attempts}
                  onChange={(e) => handleNumberChange('security', 'max_login_attempts', e.target.value)}
                  min="3"
                  max="10"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  세션 타임아웃
                </label>
                <input
                  type="number"
                  value={config.security.session_timeout_minutes}
                  onChange={(e) => handleNumberChange('security', 'session_timeout_minutes', e.target.value)}
                  min="5"
                  max="480"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-700">분 단위</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-medium text-gray-900">2단계 인증 필수</p>
                <p className="text-sm text-gray-600 mt-1">
                  모든 사용자에게 2단계 인증을 강제할지 설정
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.security.require_2fa}
                onChange={() => handleBooleanChange('security', 'require_2fa')}
                className="h-5 w-5 text-bagel-yellow focus:ring-bagel-yellow rounded"
              />
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-700">
              <DatabaseIcon className="h-4 w-4 inline mr-1" />
              변경사항은 모든 매장에 적용됩니다
            </div>
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
                  <Settings2 className="h-5 w-5 mr-2" />
                  시스템 설정 저장
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}