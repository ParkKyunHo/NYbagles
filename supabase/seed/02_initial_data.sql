-- 뉴욕러브베이글 초기 테스트 데이터 설정
-- 실행 방법: 01_initial_admin.sql 실행 후 이 파일 실행

-- 1. 지역(regions) 생성
INSERT INTO regions (id, name, code, display_order) VALUES
  ('11111111-1111-1111-1111-111111111111', '서울', 'SEOUL', 1),
  ('22222222-2222-2222-2222-222222222222', '경기', 'GYEONGGI', 2),
  ('33333333-3333-3333-3333-333333333333', '인천', 'INCHEON', 3)
ON CONFLICT (code) DO NOTHING;

-- 2. 매장 카테고리(store_categories) 생성
INSERT INTO store_categories (id, region_id, name, code, display_order) VALUES
  -- 서울 지역
  ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '강남구', 'GANGNAM', 1),
  ('aaaa2222-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '종로구', 'JONGNO', 2),
  ('aaaa3333-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '마포구', 'MAPO', 3),
  -- 경기 지역
  ('bbbb1111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', '성남시', 'SEONGNAM', 1),
  ('bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', '수원시', 'SUWON', 2)
ON CONFLICT (code) DO NOTHING;

-- 3. 매장(stores) 생성
INSERT INTO stores (id, category_id, name, code, address, phone, business_number, location_lat, location_lng, location_radius, qr_secret) VALUES
  -- 강남구 매장들
  ('store111-1111-1111-1111-111111111111', 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '강남역점', 'GANGNAM001', '서울시 강남구 테헤란로 123', '02-1111-1111', '123-45-67890', 37.498095, 127.027610, 100, encode(gen_random_bytes(32), 'base64')),
  ('store222-2222-2222-2222-222222222222', 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '삼성점', 'GANGNAM002', '서울시 강남구 삼성동 456', '02-2222-2222', '123-45-67891', 37.514575, 127.063015, 100, encode(gen_random_bytes(32), 'base64')),
  -- 종로구 매장
  ('store333-3333-3333-3333-333333333333', 'aaaa2222-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '광화문점', 'JONGNO001', '서울시 종로구 세종대로 789', '02-3333-3333', '123-45-67892', 37.571607, 126.976960, 100, encode(gen_random_bytes(32), 'base64')),
  -- 마포구 매장
  ('store444-4444-4444-4444-444444444444', 'aaaa3333-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '홍대점', 'MAPO001', '서울시 마포구 홍익로 101', '02-4444-4444', '123-45-67893', 37.556850, 126.923590, 100, encode(gen_random_bytes(32), 'base64'))
ON CONFLICT (code) DO NOTHING;

-- 4. 관리자에게 최상위 관리자 권한 부여
DO $$
DECLARE
  admin_id UUID;
BEGIN
  SELECT id INTO admin_id FROM profiles WHERE email = 'admin@nylovebagel.com';
  
  IF admin_id IS NOT NULL THEN
    -- 모든 매장에 대한 접근 권한 부여 (super_admin은 전체 접근 가능)
    RAISE NOTICE '최상위 관리자 권한이 설정되었습니다.';
  END IF;
END $$;

-- 5. 테스트 직원 계정 생성
DO $$
DECLARE
  manager_id UUID;
  employee_id UUID;
  parttime_id UUID;
  gangnam_store_id UUID := 'store111-1111-1111-1111-111111111111';
BEGIN
  -- 매니저 계정
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
    'manager@nylovebagel.com',
    crypt('Manager123!', gen_salt('bf')),
    now(),
    '{"full_name": "김매니저", "role": "manager"}'::jsonb,
    now(),
    now(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated'
  ) RETURNING id INTO manager_id;
  
  -- 매니저 프로필
  INSERT INTO profiles (id, email, full_name, role, phone)
  VALUES (
    manager_id,
    'manager@nylovebagel.com',
    '김매니저',
    'manager',
    '010-1111-1111'
  );
  
  -- 매니저를 강남역점에 배정
  INSERT INTO employees (id, user_id, store_id, qr_code, hourly_wage, employment_type, department, hire_date)
  VALUES (
    gen_random_uuid(),
    manager_id,
    gangnam_store_id,
    encode(gen_random_bytes(32), 'base64'),
    20000,
    'full_time',
    '운영팀',
    CURRENT_DATE - INTERVAL '1 year'
  );
  
  -- 정직원 계정
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
    'employee@nylovebagel.com',
    crypt('Employee123!', gen_salt('bf')),
    now(),
    '{"full_name": "이직원", "role": "employee"}'::jsonb,
    now(),
    now(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated'
  ) RETURNING id INTO employee_id;
  
  -- 정직원 프로필
  INSERT INTO profiles (id, email, full_name, role, phone)
  VALUES (
    employee_id,
    'employee@nylovebagel.com',
    '이직원',
    'employee',
    '010-2222-2222'
  );
  
  -- 정직원을 강남역점에 배정
  INSERT INTO employees (id, user_id, store_id, qr_code, hourly_wage, employment_type, department, hire_date)
  VALUES (
    gen_random_uuid(),
    employee_id,
    gangnam_store_id,
    encode(gen_random_bytes(32), 'base64'),
    15000,
    'full_time',
    '제조팀',
    CURRENT_DATE - INTERVAL '6 months'
  );
  
  -- 파트타임 계정
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
    'parttime@nylovebagel.com',
    crypt('Parttime123!', gen_salt('bf')),
    now(),
    '{"full_name": "박알바", "role": "part_time"}'::jsonb,
    now(),
    now(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated'
  ) RETURNING id INTO parttime_id;
  
  -- 파트타임 프로필
  INSERT INTO profiles (id, email, full_name, role, phone)
  VALUES (
    parttime_id,
    'parttime@nylovebagel.com',
    '박알바',
    'part_time',
    '010-3333-3333'
  );
  
  -- 파트타임을 강남역점에 배정
  INSERT INTO employees (id, user_id, store_id, qr_code, hourly_wage, employment_type, department, hire_date)
  VALUES (
    gen_random_uuid(),
    parttime_id,
    gangnam_store_id,
    encode(gen_random_bytes(32), 'base64'),
    10000,
    'part_time',
    '서비스팀',
    CURRENT_DATE - INTERVAL '3 months'
  );
  
  RAISE NOTICE '테스트 직원 계정이 생성되었습니다.';
END $$;

-- 6. 결과 확인
SELECT '=== 생성된 지역 ===' AS section;
SELECT id, name, code FROM regions ORDER BY display_order;

SELECT '=== 생성된 매장 카테고리 ===' AS section;
SELECT sc.name AS category, r.name AS region, sc.code 
FROM store_categories sc
JOIN regions r ON sc.region_id = r.id
ORDER BY r.display_order, sc.display_order;

SELECT '=== 생성된 매장 ===' AS section;
SELECT s.name AS store, s.code, sc.name AS category, r.name AS region
FROM stores s
JOIN store_categories sc ON s.category_id = sc.id
JOIN regions r ON sc.region_id = r.id
ORDER BY r.display_order, sc.display_order, s.name;

SELECT '=== 생성된 계정 ===' AS section;
SELECT 
  p.email,
  p.full_name,
  p.role,
  CASE 
    WHEN e.id IS NOT NULL THEN s.name
    ELSE '매장 미배정'
  END AS store
FROM profiles p
LEFT JOIN employees e ON p.id = e.user_id
LEFT JOIN stores s ON e.store_id = s.id
ORDER BY 
  CASE p.role 
    WHEN 'super_admin' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'manager' THEN 3
    WHEN 'employee' THEN 4
    WHEN 'part_time' THEN 5
  END;