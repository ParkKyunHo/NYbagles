# 직원 연락처 실시간 업데이트 기능 구현 문서

## 📋 개요
NYbalges 베이글샵 시스템의 직원 연락처 수정 기능을 구현했습니다. 직원이 설정 페이지에서 자신의 연락처를 수정하면, 관리자가 보는 직원관리 대시보드에 실시간으로 반영됩니다.

## 🎯 주요 기능

### 1. 직원 설정 페이지 (/dashboard/settings)
- ✅ 연락처(전화번호) 수정 폼
- ✅ 실시간 유효성 검증
- ✅ 성공/실패 메시지 표시
- ✅ 자동 캐시 무효화

### 2. 직원관리 대시보드 (/dashboard/employees)
- ✅ Supabase 실시간 구독을 통한 자동 업데이트
- ✅ 업데이트 알림 표시
- ✅ 즉각적인 UI 반영 (새로고침 불필요)

## 🏗️ 기술 구현

### 파일 구조
```
/home/albra/NYbalges/bagel-shop/
├── app/
│   ├── api/
│   │   └── profile/
│   │       └── update/
│   │           └── route.ts              # Profile 업데이트 API
│   └── (dashboard)/
│       └── dashboard/
│           ├── settings/
│           │   └── components/
│           │       └── ProfileSettings.tsx # 프로필 설정 컴포넌트
│           └── employees/
│               └── EmployeesClient.tsx    # 직원 목록 (실시간 구독)
├── components/
│   └── ui/
│       └── RealtimeNotification.tsx      # 실시간 알림 컴포넌트
├── lib/
│   └── actions/
│       └── profile.actions.ts            # 프로필 관련 Server Actions
├── supabase/
│   └── migrations/
│       └── 20240315_enable_realtime_profiles.sql # DB 실시간 설정
└── scripts/
    └── test-realtime-update.ts          # 테스트 스크립트
```

### 핵심 컴포넌트

#### 1. ProfileSettings.tsx
```typescript
// 주요 기능:
- 전화번호 유효성 검증 (한국 휴대폰 번호 형식)
- Server Action을 통한 업데이트
- 성공/실패 피드백 UI
- 자동 캐시 갱신
```

#### 2. EmployeesClient.tsx
```typescript
// 실시간 구독 코드:
const channel = supabase
  .channel('profiles-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'profiles'
  }, (payload) => {
    // 직원 목록 자동 업데이트
    // 알림 표시
  })
  .subscribe();
```

#### 3. profile.actions.ts
```typescript
// Server Actions:
- updateProfile(): 프로필 업데이트 + 캐시 무효화
- getCurrentProfile(): 현재 사용자 프로필 조회
- getProfileById(): 특정 사용자 프로필 조회 (관리자용)
```

### 데이터베이스 설정

#### SQL Migration
```sql
-- 실시간 구독 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 인덱스 추가 (성능 최적화)
CREATE INDEX idx_profiles_phone ON profiles(phone);
CREATE INDEX idx_profiles_email ON profiles(email);
```

## 🔧 사용 방법

### 직원 (연락처 수정)
1. `/dashboard/settings` 페이지 접속
2. 개인정보 설정 섹션에서 전화번호 수정
3. "변경사항 저장" 버튼 클릭
4. 성공 메시지 확인

### 관리자 (실시간 확인)
1. `/dashboard/employees` 페이지 열어두기
2. 직원이 연락처 수정 시 자동으로 업데이트됨
3. 우측 상단에 실시간 알림 표시
4. 테이블의 연락처 정보 즉시 변경

## 🧪 테스트

### 실시간 업데이트 테스트
```bash
# 테스트 스크립트 실행
npx tsx scripts/test-realtime-update.ts

# 또는 개발 서버에서 직접 테스트
1. 두 개의 브라우저 탭 열기
2. 탭1: /dashboard/employees (관리자 계정)
3. 탭2: /dashboard/settings (직원 계정)
4. 탭2에서 연락처 수정
5. 탭1에서 실시간 업데이트 확인
```

## 🔐 보안 고려사항

### RLS (Row Level Security) 정책
```sql
-- 사용자는 자신의 프로필만 수정 가능
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 관리자는 모든 프로필 조회 가능
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin', 'manager')
    )
  );
```

### 입력 검증
- 전화번호 형식 검증 (정규식)
- SQL Injection 방지 (Parameterized Queries)
- XSS 방지 (자동 이스케이핑)

## 🚀 성능 최적화

### 캐시 전략
```typescript
// 캐시 무효화 경로
revalidatePath('/dashboard/settings');
revalidatePath('/dashboard/employees');
revalidatePath('/dashboard');
```

### 데이터베이스 인덱스
- `phone` 컬럼 인덱스
- `email` 컬럼 인덱스
- 복합 인덱스 고려 (필요시)

## 📊 모니터링

### 실시간 업데이트 로그
```typescript
// 콘솔 로그로 실시간 이벤트 추적
console.log('Profile change detected:', payload);
```

### 에러 처리
- API 에러 로깅
- 사용자 친화적 에러 메시지
- 자동 재시도 메커니즘 (옵션)

## 🔄 향후 개선사항

1. **오프라인 지원**: 
   - 오프라인 상태에서 수정 내용 큐잉
   - 온라인 복귀 시 자동 동기화

2. **변경 이력 추가**:
   - profiles_history 테이블 생성
   - 모든 변경사항 추적

3. **대량 업데이트**:
   - 관리자가 여러 직원 정보 일괄 수정
   - CSV 가져오기/내보내기

4. **알림 개선**:
   - 이메일/SMS 알림
   - 푸시 알림 (PWA)

5. **권한 세분화**:
   - 부서별 관리자 권한
   - 필드별 수정 권한 제어

## 📝 문제 해결

### 실시간 업데이트가 작동하지 않을 때
1. Supabase 대시보드에서 Realtime 설정 확인
2. `profiles` 테이블이 publication에 추가되었는지 확인
3. 브라우저 콘솔에서 WebSocket 연결 상태 확인
4. 네트워크 탭에서 실시간 연결 확인

### 캐시 문제
1. 브라우저 캐시 삭제
2. Next.js 캐시 삭제: `rm -rf .next`
3. 개발 서버 재시작

## 🤝 기여 가이드

이 기능을 개선하거나 버그를 발견하면:
1. Issue 생성
2. Feature 브랜치 생성
3. 테스트 작성
4. PR 제출

## 📚 참고 자료
- [Supabase Realtime Documentation](https://supabase.com/docs/guides/realtime)
- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions)
- [Next.js Caching](https://nextjs.org/docs/app/building-your-application/caching)