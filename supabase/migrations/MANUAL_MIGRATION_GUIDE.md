# 수동 마이그레이션 가이드

## 1. employee_number 필드 추가 (필수)

Supabase Dashboard > SQL Editor에서 다음 SQL을 실행하세요:

```sql
-- Add employee_number field to employees table
-- Migration: 20250127003000_add_employee_number_field.sql

-- 1. Add employee_number column to employees table
ALTER TABLE employees 
  ADD COLUMN IF NOT EXISTS employee_number TEXT;

-- 2. Create a sequence for employee numbers
CREATE SEQUENCE IF NOT EXISTS employee_number_seq START 1000;

-- 3. Update existing employees with sequential employee numbers
UPDATE employees 
SET employee_number = 'EMP' || LPAD(nextval('employee_number_seq')::TEXT, 4, '0')
WHERE employee_number IS NULL;

-- 4. Make employee_number NOT NULL and UNIQUE
ALTER TABLE employees 
  ALTER COLUMN employee_number SET NOT NULL,
  ADD CONSTRAINT employees_employee_number_unique UNIQUE (employee_number);

-- 5. Create a function to generate employee numbers automatically
CREATE OR REPLACE FUNCTION generate_employee_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.employee_number IS NULL THEN
    NEW.employee_number := 'EMP' || LPAD(nextval('employee_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger to auto-generate employee numbers
CREATE TRIGGER set_employee_number
  BEFORE INSERT ON employees
  FOR EACH ROW
  EXECUTE FUNCTION generate_employee_number();

-- 7. Create index for better performance
CREATE INDEX IF NOT EXISTS idx_employees_employee_number ON employees(employee_number);

-- 8. Add comment
COMMENT ON COLUMN employees.employee_number IS '자동 생성되는 사번 (EMP1000 형식)';
```

## 2. 직원 매장 할당 확인 (필수)

직원이 매장에 할당되어 있는지 확인:

```sql
-- 매장이 할당되지 않은 직원 확인
SELECT 
  e.id,
  e.user_id,
  p.email,
  p.full_name,
  e.store_id
FROM employees e
JOIN profiles p ON e.user_id = p.id
WHERE e.store_id IS NULL;

-- 활성 매장 목록 확인
SELECT id, name, code 
FROM stores 
WHERE is_active = true;

-- 매장이 없는 직원에게 기본 매장 할당 (예: 강남역점)
UPDATE employees 
SET store_id = (SELECT id FROM stores WHERE code = 'GANGNAM001' LIMIT 1)
WHERE store_id IS NULL;
```

## 3. 검증

마이그레이션이 성공적으로 완료되었는지 확인:

```sql
-- employee_number가 생성되었는지 확인
SELECT id, employee_number, user_id, store_id 
FROM employees 
ORDER BY employee_number;

-- 모든 직원이 매장에 할당되었는지 확인
SELECT COUNT(*) as employees_without_store
FROM employees 
WHERE store_id IS NULL;
```

## 완료 후 테스트

1. 판매 입력 페이지 (`/sales`) 접속 - 오류 없이 상품 목록이 표시되어야 함
2. 판매 내역 페이지 (`/sales/history`) 접속 - 데이터가 정상적으로 로드되어야 함
3. 직원 관리 페이지 (`/dashboard/employees`) 접속 - 사번이 표시되어야 함