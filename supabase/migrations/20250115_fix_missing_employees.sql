-- 승인되었지만 employees 레코드가 없는 사용자 복구
-- 2025-01-15: employees 테이블의 qr_code 필드 누락으로 인한 데이터 복구

-- 1. 먼저 user_id에 UNIQUE 제약 조건 추가 (필요한 경우)
-- employees 테이블에서 한 사용자는 하나의 직원 레코드만 가져야 함
DO $$
BEGIN
  -- user_id에 대한 UNIQUE 제약이 없는 경우 추가
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'employees_user_id_key' 
    AND conrelid = 'employees'::regclass
  ) THEN
    ALTER TABLE employees ADD CONSTRAINT employees_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- 2. 승인된 직원 중 employees 레코드가 없는 사용자 찾기 및 복구
-- 이미 존재하는 레코드는 건너뛰기
INSERT INTO employees (
  user_id, 
  store_id, 
  qr_code, 
  hourly_wage,
  employment_type,
  department,
  hire_date, 
  is_active
)
SELECT 
  p.id as user_id,
  p.store_id,
  'EMP-RECOVERY-' || p.id || '-' || extract(epoch from now())::text || '-' || substr(md5(random()::text), 1, 8) as qr_code,
  10500 as hourly_wage, -- 최저시급
  CASE 
    WHEN p.role = 'part_time' THEN 'part_time'
    ELSE 'full_time'
  END as employment_type,
  '미지정' as department,
  COALESCE(r.approved_at::date, CURRENT_DATE) as hire_date,
  true as is_active
FROM profiles p
LEFT JOIN employees e ON e.user_id = p.id
LEFT JOIN employee_signup_requests r ON r.email = p.email
WHERE e.id IS NULL
  AND p.role IN ('employee', 'part_time', 'manager')
  AND r.status = 'approved'
ON CONFLICT (user_id) DO NOTHING;

-- 3. 자동 직원 레코드 생성을 위한 트리거 추가
-- profiles 생성 시 자동으로 employees 레코드 생성
CREATE OR REPLACE FUNCTION handle_new_employee()
RETURNS TRIGGER AS $$
BEGIN
  -- profiles 생성 시 role이 직원 관련이면 자동으로 employees 레코드 생성
  IF NEW.role IN ('employee', 'part_time', 'manager') AND NEW.store_id IS NOT NULL THEN
    INSERT INTO employees (
      user_id, 
      store_id,
      qr_code,
      hourly_wage,
      employment_type,
      department,
      hire_date,
      is_active
    ) VALUES (
      NEW.id,
      NEW.store_id,
      'EMP-' || NEW.id || '-' || extract(epoch from now())::text || '-' || substr(md5(random()::text), 1, 8),
      10500, -- 최저시급
      CASE 
        WHEN NEW.role = 'part_time' THEN 'part_time'
        ELSE 'full_time'
      END,
      '미지정',
      CURRENT_DATE,
      true
    ) ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거 생성 (존재하지 않을 때만)
DROP TRIGGER IF EXISTS create_employee_after_profile ON profiles;
CREATE TRIGGER create_employee_after_profile
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_new_employee();

-- 4. 데이터 검증 쿼리 (실행 후 확인용)
-- 이 쿼리로 복구된 직원 수를 확인할 수 있습니다
DO $$
DECLARE
  recovered_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO recovered_count
  FROM employees e
  WHERE e.qr_code LIKE 'EMP-RECOVERY-%';
  
  RAISE NOTICE '복구된 직원 수: %', recovered_count;
END $$;

-- 5. 인덱스 추가로 성능 최적화
CREATE INDEX IF NOT EXISTS idx_employees_user_store ON employees(user_id, store_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role_store ON profiles(role, store_id);
CREATE INDEX IF NOT EXISTS idx_employees_qr_code ON employees(qr_code);