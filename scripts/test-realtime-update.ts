/**
 * 실시간 업데이트 테스트 스크립트
 * 
 * 사용법:
 * 1. 터미널에서 실행: npx tsx scripts/test-realtime-update.ts
 * 2. 브라우저에서 직원관리 대시보드를 열어둔 상태에서 테스트
 * 3. 다른 브라우저 탭에서 설정 페이지에서 연락처를 수정
 * 4. 직원관리 대시보드에서 실시간 업데이트 확인
 */

import { createClient } from '@supabase/supabase-js';

// Supabase 클라이언트 설정 (환경변수 사용)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testRealtimeUpdate() {
  console.log('🔄 실시간 업데이트 테스트 시작...\n');
  
  // 1. profiles 테이블 구독
  console.log('📡 profiles 테이블 실시간 구독 시작...');
  
  const channel = supabase
    .channel('test-profiles-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'profiles'
      },
      (payload) => {
        console.log('\n✅ 실시간 이벤트 수신!');
        console.log('이벤트 타입:', payload.eventType);
        
        if (payload.eventType === 'UPDATE') {
          console.log('변경된 데이터:');
          console.log('- 이름:', payload.new.full_name);
          console.log('- 전화번호:', payload.new.phone);
          console.log('- 업데이트 시간:', payload.new.updated_at);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('✅ 구독 성공! 실시간 업데이트를 기다리는 중...\n');
        console.log('💡 테스트 방법:');
        console.log('1. 브라우저에서 /dashboard/settings 페이지를 엽니다.');
        console.log('2. 연락처를 수정하고 저장합니다.');
        console.log('3. 이 터미널에서 실시간 업데이트를 확인합니다.');
        console.log('4. /dashboard/employees 페이지에서도 자동 업데이트를 확인합니다.\n');
        console.log('종료하려면 Ctrl+C를 누르세요.\n');
      }
    });
  
  // 프로세스 종료 처리
  process.on('SIGINT', () => {
    console.log('\n\n🛑 테스트 종료 중...');
    supabase.removeChannel(channel);
    process.exit(0);
  });
}

// 테스트 실행
testRealtimeUpdate().catch(console.error);