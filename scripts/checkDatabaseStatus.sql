-- 데이터베이스 상태 확인 스크립트
-- Supabase SQL Editor에서 실행

-- 1. 현재 사용자 수 확인
SELECT COUNT(*) as user_count FROM auth.users;

-- 2. 프로필 수 확인
SELECT COUNT(*) as profile_count FROM profiles;

-- 3. 직원 수 확인
SELECT COUNT(*) as employee_count FROM employees;

-- 4. 매장 정보 확인
SELECT id, name, code, is_active FROM stores;

-- 5. 대기 중인 가입 요청
SELECT 
  id,
  full_name,
  email,
  phone,
  store_id,
  status,
  created_at
FROM employee_signup_requests
WHERE status IN ('pending', 'verified')
ORDER BY created_at DESC;

-- 6. auth.users 트리거 확인
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
AND event_object_table = 'users';

-- 7. 프로필 테이블 제약조건 확인
SELECT 
  column_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'profiles';

-- 8. 직원 테이블 제약조건 확인
SELECT 
  column_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'employees';