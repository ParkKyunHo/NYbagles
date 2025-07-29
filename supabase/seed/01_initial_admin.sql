-- 뉴욕러브베이글 초기 관리자 및 데이터 설정
-- 실행 방법: Supabase 대시보드 SQL Editor에서 실행

-- 1. handle_new_user 트리거 임시 비활성화
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. 관리자 계정 생성
DO $$
DECLARE
  admin_id UUID;
BEGIN
  -- 기존 관리자 계정 확인
  SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@nylovebagel.com';
  
  IF admin_id IS NULL THEN
    -- 관리자 계정 생성
    INSERT INTO auth.users (
      id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_user_meta_data,
      created_at,
      updated_at,
      instance_id,
      aud,
      role
    ) VALUES (
      gen_random_uuid(),
      'admin@nylovebagel.com',
      crypt('Admin123!@#', gen_salt('bf')),
      now(),
      '{"full_name": "시스템 관리자", "role": "super_admin"}'::jsonb,
      now(),
      now(),
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated'
    ) RETURNING id INTO admin_id;
    
    -- 프로필 생성
    INSERT INTO profiles (id, email, full_name, role, phone)
    VALUES (
      admin_id,
      'admin@nylovebagel.com',
      '시스템 관리자',
      'super_admin',
      '010-0000-0000'
    );
    
    RAISE NOTICE '관리자 계정이 생성되었습니다. ID: %', admin_id;
  ELSE
    RAISE NOTICE '관리자 계정이 이미 존재합니다. ID: %', admin_id;
  END IF;
END $$;

-- 3. handle_new_user 트리거 재활성화
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 4. 결과 확인
SELECT 
  u.id,
  u.email,
  u.created_at,
  p.full_name,
  p.role
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE u.email = 'admin@nylovebagel.com';