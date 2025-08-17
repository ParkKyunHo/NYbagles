'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface UpdateProfileData {
  full_name: string;
  phone?: string | null;
}

export interface UpdateProfileResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
}

/**
 * 프로필 정보 업데이트
 */
export async function updateProfile(data: UpdateProfileData): Promise<UpdateProfileResult> {
  try {
    const supabase = await createClient();
    
    // 현재 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return {
        success: false,
        error: '인증되지 않은 요청입니다.'
      };
    }

    // 유효성 검사
    if (!data.full_name || data.full_name.trim().length === 0) {
      return {
        success: false,
        error: '이름은 필수 입력 항목입니다.'
      };
    }

    // 전화번호 형식 검증
    if (data.phone && data.phone.trim().length > 0) {
      const phoneRegex = /^(010|011|016|017|018|019)-?\d{3,4}-?\d{4}$/;
      const cleanPhone = data.phone.replace(/-/g, '');
      
      if (!phoneRegex.test(cleanPhone)) {
        return {
          success: false,
          error: '올바른 전화번호 형식이 아닙니다. (예: 010-1234-5678)'
        };
      }
    }

    // 프로필 업데이트
    const { data: profile, error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: data.full_name.trim(),
        phone: data.phone && data.phone.trim().length > 0 ? data.phone.trim() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Profile update error:', updateError);
      return {
        success: false,
        error: '프로필 업데이트 중 오류가 발생했습니다.'
      };
    }

    // 캐시 무효화 - 관련된 모든 페이지
    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard/employees');
    revalidatePath('/dashboard');
    revalidatePath('/');

    return {
      success: true,
      message: '프로필이 성공적으로 업데이트되었습니다.',
      data: profile
    };

  } catch (error) {
    console.error('Profile update error:', error);
    return {
      success: false,
      error: '서버 오류가 발생했습니다.'
    };
  }
}

/**
 * 현재 사용자의 프로필 정보 조회
 */
export async function getCurrentProfile() {
  try {
    const supabase = await createClient();
    
    // 현재 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return {
        success: false,
        error: '인증되지 않은 요청입니다.'
      };
    }

    // 프로필 조회
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Profile fetch error:', error);
      return {
        success: false,
        error: '프로필 정보를 가져올 수 없습니다.'
      };
    }

    return {
      success: true,
      data: profile
    };

  } catch (error) {
    console.error('Profile fetch error:', error);
    return {
      success: false,
      error: '서버 오류가 발생했습니다.'
    };
  }
}

/**
 * 다른 사용자의 프로필 정보 조회 (관리자용)
 */
export async function getProfileById(profileId: string) {
  try {
    const supabase = await createClient();
    
    // 현재 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return {
        success: false,
        error: '인증되지 않은 요청입니다.'
      };
    }

    // 현재 사용자의 권한 확인
    const { data: currentProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !currentProfile) {
      return {
        success: false,
        error: '권한 확인에 실패했습니다.'
      };
    }

    // 관리자 권한 체크
    const isAdmin = ['super_admin', 'admin', 'manager'].includes(currentProfile.role);
    
    // 본인이거나 관리자인 경우만 조회 가능
    if (profileId !== user.id && !isAdmin) {
      return {
        success: false,
        error: '권한이 없습니다.'
      };
    }

    // 프로필 조회
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .single();

    if (error) {
      console.error('Profile fetch error:', error);
      return {
        success: false,
        error: '프로필 정보를 가져올 수 없습니다.'
      };
    }

    return {
      success: true,
      data: profile
    };

  } catch (error) {
    console.error('Profile fetch error:', error);
    return {
      success: false,
      error: '서버 오류가 발생했습니다.'
    };
  }
}