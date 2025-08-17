'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Database } from '@/types/supabase';
import { Save, User, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { updateProfile } from '@/lib/actions/profile.actions';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface ProfileSettingsProps {
  profile: Profile;
  onUpdate: () => void;
}

export default function ProfileSettings({ profile, onUpdate }: ProfileSettingsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    full_name: profile.full_name,
    email: profile.email,
    phone: profile.phone || '',
    employee_code: profile.employee_code || ''
  });
  
  const supabase = createClient();

  // 성공 메시지 자동 숨김
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // 에러 메시지 자동 숨김
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Server Action을 통한 업데이트 (캐시 무효화 포함)
      const result = await updateProfile({
        full_name: formData.full_name,
        phone: formData.phone
      });

      if (!result.success) {
        throw new Error(result.error || '프로필 업데이트에 실패했습니다.');
      }

      setSuccess(true);
      onUpdate();
      
      // 페이지 새로고침으로 캐시 갱신
      router.refresh();
      
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setError(error.message || '프로필 업데이트에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const getRoleDisplay = (role: string) => {
    const roleMap: Record<string, string> = {
      super_admin: '최고 관리자',
      admin: '관리자',
      manager: '매니저',
      employee: '정직원',
      part_time: '파트타임'
    };
    return roleMap[role] || role;
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <User className="h-6 w-6 mr-2" />
          개인정보 설정
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          프로필 정보를 확인하고 수정할 수 있습니다.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              이름 *
            </label>
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              이메일
            </label>
            <input
              type="email"
              value={formData.email}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700"
            />
            <p className="mt-1 text-xs text-gray-700">
              이메일은 변경할 수 없습니다
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              전화번호
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              placeholder="010-0000-0000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              직원 코드
            </label>
            <input
              type="text"
              value={formData.employee_code}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              역할
            </label>
            <input
              type="text"
              value={getRoleDisplay(profile.role)}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              계정 생성일
            </label>
            <input
              type="text"
              value={new Date(profile.created_at).toLocaleDateString('ko-KR')}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700"
            />
          </div>
        </div>

        {/* 알림 메시지 */}
        {success && (
          <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            <Check className="h-5 w-5" />
            <span>프로필이 성공적으로 업데이트되었습니다.</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}

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
                <Save className="h-5 w-5 mr-2" />
                변경사항 저장
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}