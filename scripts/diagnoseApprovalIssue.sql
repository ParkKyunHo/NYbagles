-- 직원 가입 승인 문제 진단 스크립트
-- Supabase SQL Editor에서 실행하세요

-- 1. 트리거 상태 확인
SELECT 'Checking auth triggers...' as step;
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing,
  action_orientation
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
AND event_object_table = 'users';

-- 2. handle_new_user 함수 확인
SELECT 'Checking handle_new_user function...' as step;
SELECT 
  routine_name,
  data_type,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'handle_new_user';

-- 3. profiles 테이블 제약조건 확인
SELECT 'Checking profiles constraints...' as step;
SELECT 
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public'
AND table_name = 'profiles'
ORDER BY constraint_type;

-- 4. 중복 이메일 확인
SELECT 'Checking duplicate emails...' as step;
SELECT 
  email,
  COUNT(*) as count
FROM profiles
GROUP BY email
HAVING COUNT(*) > 1;

-- 5. 대기 중인 가입 요청과 기존 프로필 비교
SELECT 'Checking pending requests vs existing profiles...' as step;
SELECT 
  esr.id,
  esr.email,
  esr.full_name,
  esr.status,
  CASE WHEN p.id IS NOT NULL THEN 'EXISTS' ELSE 'NOT EXISTS' END as profile_status,
  CASE WHEN au.id IS NOT NULL THEN 'EXISTS' ELSE 'NOT EXISTS' END as auth_user_status
FROM employee_signup_requests esr
LEFT JOIN profiles p ON esr.email = p.email
LEFT JOIN auth.users au ON esr.email = au.email
WHERE esr.status IN ('pending', 'verified')
ORDER BY esr.created_at DESC
LIMIT 10;

-- 6. auth.users와 profiles 동기화 확인
SELECT 'Checking auth.users vs profiles sync...' as step;
SELECT 
  au.id,
  au.email,
  au.created_at,
  CASE WHEN p.id IS NOT NULL THEN 'YES' ELSE 'NO' END as has_profile,
  CASE WHEN e.user_id IS NOT NULL THEN 'YES' ELSE 'NO' END as has_employee_record
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
LEFT JOIN employees e ON au.id = e.user_id
WHERE au.created_at > NOW() - INTERVAL '7 days'
ORDER BY au.created_at DESC;

-- 7. 최근 오류 로그 확인 (있다면)
SELECT 'Recent signup request updates...' as step;
SELECT 
  id,
  email,
  full_name,
  status,
  approved,
  approved_at,
  updated_at
FROM employee_signup_requests
WHERE updated_at > NOW() - INTERVAL '1 day'
ORDER BY updated_at DESC
LIMIT 10;