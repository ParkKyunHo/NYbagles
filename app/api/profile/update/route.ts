import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // 현재 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: '인증되지 않은 요청입니다.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { full_name, phone } = body;

    // 유효성 검사
    if (!full_name || full_name.trim().length === 0) {
      return NextResponse.json(
        { error: '이름은 필수 입력 항목입니다.' },
        { status: 400 }
      );
    }

    // 전화번호 형식 검증 (선택사항)
    if (phone && phone.trim().length > 0) {
      const phoneRegex = /^(010|011|016|017|018|019)-?\d{3,4}-?\d{4}$/;
      if (!phoneRegex.test(phone.replace(/-/g, ''))) {
        return NextResponse.json(
          { error: '올바른 전화번호 형식이 아닙니다.' },
          { status: 400 }
        );
      }
    }

    // 프로필 업데이트
    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name: full_name.trim(),
        phone: phone && phone.trim().length > 0 ? phone.trim() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Profile update error:', error);
      return NextResponse.json(
        { error: '프로필 업데이트 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    // 캐시 무효화
    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard/employees');
    revalidatePath('/dashboard');

    return NextResponse.json({
      success: true,
      message: '프로필이 성공적으로 업데이트되었습니다.',
      data
    });

  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // 현재 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: '인증되지 않은 요청입니다.' },
        { status: 401 }
      );
    }

    // 프로필 정보 조회
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Profile fetch error:', error);
      return NextResponse.json(
        { error: '프로필 정보를 가져올 수 없습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}