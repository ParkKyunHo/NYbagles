# Database User Creation Error 해결 가이드

## 문제
오류코드 500 - "Database error creating new user"

## 원인
이 오류는 Supabase의 auth.users 테이블에 사용자를 생성할 때 발생하는 데이터베이스 레벨 오류입니다.

## 가능한 원인들

### 1. Email 중복
- 이미 동일한 이메일로 가입된 사용자가 있을 수 있습니다.
- Supabase는 이메일 중복을 허용하지 않습니다.

### 2. Database Trigger 오류
- auth.users 테이블의 트리거가 오류를 발생시킬 수 있습니다.

### 3. RLS (Row Level Security) 정책
- auth 스키마의 보안 정책이 사용자 생성을 막을 수 있습니다.

## 해결 방법

### 방법 1: Supabase Dashboard에서 직접 확인

1. https://supabase.com/dashboard 접속
2. 프로젝트 선택
3. **Authentication** → **Users** 메뉴로 이동
4. 해당 이메일로 이미 가입된 사용자가 있는지 확인

### 방법 2: SQL Editor에서 확인 및 정리

Supabase SQL Editor에서 다음 쿼리 실행:

```sql
-- 1. 중복된 이메일 확인
SELECT id, email, created_at, last_sign_in_at
FROM auth.users
WHERE email = '문제가_발생한_이메일@example.com';

-- 2. 만약 이미 존재하면 삭제 (주의!)
-- DELETE FROM auth.users WHERE email = '문제가_발생한_이메일@example.com';

-- 3. 프로필과 직원 레코드도 확인
SELECT * FROM profiles WHERE email = '문제가_발생한_이메일@example.com';
SELECT e.* FROM employees e 
JOIN profiles p ON e.user_id = p.id 
WHERE p.email = '문제가_발생한_이메일@example.com';

-- 4. Trigger 상태 확인
SELECT 
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'auth'
AND event_object_table = 'users';
```

### 방법 3: 프로그램 코드 수정

1. 이메일 중복 체크 추가
2. 더 상세한 에러 로깅
3. 기존 사용자 업데이트 로직 개선

### 방법 4: Supabase 프로젝트 설정 확인

1. **Settings** → **Auth** 메뉴로 이동
2. **User Signups** 설정 확인:
   - "Enable email confirmations" 설정
   - "Enable new user signups" 활성화 확인

### 방법 5: Service Role Key 권한 확인

Service Role Key가 사용자 생성 권한이 있는지 확인:
- auth.users 테이블에 대한 INSERT 권한
- auth.identities 테이블에 대한 INSERT 권한

## 임시 해결책

문제가 계속되면, 수동으로 사용자를 생성할 수 있습니다:

1. Supabase Dashboard → Authentication → Users
2. "Invite User" 버튼 클릭
3. 이메일 입력 후 초대 링크 발송

## 로그 확인 방법

Vercel 로그에서 더 자세한 오류 메시지 확인:
1. https://vercel.com 접속
2. 프로젝트 선택
3. **Functions** 탭 → 로그 확인
4. `/api/admin/signup-requests/[id]/approve` 엔드포인트 로그 찾기