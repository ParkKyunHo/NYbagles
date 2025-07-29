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