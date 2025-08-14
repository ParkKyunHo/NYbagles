-- =============================================
-- NYbagles 완전 재설계 마이그레이션
-- 목표: 직원 회원가입, 출퇴근 기록, POS 기능
-- =============================================

-- 1. 불필요한 테이블 정리
DROP TABLE IF EXISTS schedule_templates CASCADE;
DROP TABLE IF EXISTS employee_schedules CASCADE;
DROP TABLE IF EXISTS price_history CASCADE;

-- 2. 누락된 테이블 생성
-- daily_sales_summary 테이블 (일일 매출 집계)
CREATE TABLE IF NOT EXISTS daily_sales_summary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  sale_date DATE NOT NULL,
  total_sales DECIMAL(10,2) DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  cash_sales DECIMAL(10,2) DEFAULT 0,
  card_sales DECIMAL(10,2) DEFAULT 0,
  mobile_sales DECIMAL(10,2) DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, sale_date)
);

-- 3. 출퇴근 기록 테이블 개선
ALTER TABLE attendance_records 
ADD COLUMN IF NOT EXISTS qr_code TEXT,
ADD COLUMN IF NOT EXISTS location_lat DECIMAL(10,8),
ADD COLUMN IF NOT EXISTS location_lng DECIMAL(11,8);

-- 4. RPC 함수 생성
-- 재고 증가 함수
CREATE OR REPLACE FUNCTION increment_stock(
  p_product_id UUID,
  p_quantity INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE products 
  SET stock_quantity = stock_quantity + p_quantity
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- 일일 마감 함수
CREATE OR REPLACE FUNCTION create_daily_closing(
  p_store_id UUID,
  p_closing_date DATE,
  p_created_by UUID
)
RETURNS json AS $$
DECLARE
  v_result json;
BEGIN
  -- 해당 날짜의 판매 데이터 집계
  INSERT INTO daily_sales_summary (
    store_id,
    sale_date,
    total_sales,
    transaction_count,
    cash_sales,
    card_sales,
    mobile_sales,
    created_by
  )
  SELECT 
    p_store_id,
    p_closing_date,
    COALESCE(SUM(total_amount), 0),
    COUNT(*),
    COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_method = 'mobile' THEN total_amount ELSE 0 END), 0),
    p_created_by
  FROM sales_transactions
  WHERE store_id = p_store_id
    AND DATE(sold_at) = p_closing_date
    AND payment_status = 'completed'
  ON CONFLICT (store_id, sale_date) 
  DO UPDATE SET
    total_sales = EXCLUDED.total_sales,
    transaction_count = EXCLUDED.transaction_count,
    cash_sales = EXCLUDED.cash_sales,
    card_sales = EXCLUDED.card_sales,
    mobile_sales = EXCLUDED.mobile_sales,
    updated_at = NOW()
  RETURNING json_build_object(
    'total_sales', total_sales,
    'transaction_count', transaction_count,
    'cash_sales', cash_sales,
    'card_sales', card_sales,
    'mobile_sales', mobile_sales
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 5. RLS 정책 재정비
-- employees 테이블 RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees can view own record" ON employees;
CREATE POLICY "Employees can view own record" ON employees
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Managers can view all employees in store" ON employees;
CREATE POLICY "Managers can view all employees in store" ON employees
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM employees e
      JOIN profiles p ON e.user_id = p.id
      WHERE e.user_id = auth.uid()
      AND p.role IN ('admin', 'manager', 'super_admin')
    )
  );

-- products 테이블 RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active products" ON products;
CREATE POLICY "Anyone can view active products" ON products
  FOR SELECT USING (status = 'active');

DROP POLICY IF EXISTS "Managers can manage products" ON products;
CREATE POLICY "Managers can manage products" ON products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'super_admin')
    )
  );

-- sales_transactions 테이블 RLS
ALTER TABLE sales_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees can view own sales" ON sales_transactions;
CREATE POLICY "Employees can view own sales" ON sales_transactions
  FOR SELECT USING (sold_by = auth.uid());

DROP POLICY IF EXISTS "Managers can view all sales" ON sales_transactions;
CREATE POLICY "Managers can view all sales" ON sales_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Employees can create sales" ON sales_transactions;
CREATE POLICY "Employees can create sales" ON sales_transactions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE user_id = auth.uid()
    )
  );

-- sales_items 테이블 RLS
ALTER TABLE sales_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View sales items with transaction access" ON sales_items;
CREATE POLICY "View sales items with transaction access" ON sales_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sales_transactions
      WHERE id = sales_items.sale_id
      AND (
        sold_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid()
          AND role IN ('admin', 'manager', 'super_admin')
        )
      )
    )
  );

DROP POLICY IF EXISTS "Create sales items with transaction" ON sales_items;
CREATE POLICY "Create sales items with transaction" ON sales_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_transactions
      WHERE id = sales_items.sale_id
      AND sold_by = auth.uid()
    )
  );

-- attendance_records 테이블 RLS
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees can view own attendance" ON attendance_records;
CREATE POLICY "Employees can view own attendance" ON attendance_records
  FOR SELECT USING (employee_id IN (
    SELECT id FROM employees WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Employees can clock in/out" ON attendance_records;
CREATE POLICY "Employees can clock in/out" ON attendance_records
  FOR INSERT WITH CHECK (employee_id IN (
    SELECT id FROM employees WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Employees can update own attendance" ON attendance_records;
CREATE POLICY "Employees can update own attendance" ON attendance_records
  FOR UPDATE USING (employee_id IN (
    SELECT id FROM employees WHERE user_id = auth.uid()
  ));

-- 6. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_sales_transactions_store_date 
  ON sales_transactions(store_id, sold_at);
  
CREATE INDEX IF NOT EXISTS idx_sales_items_sale_id 
  ON sales_items(sale_id);
  
CREATE INDEX IF NOT EXISTS idx_attendance_records_employee_date 
  ON attendance_records(employee_id, check_in_time);
  
CREATE INDEX IF NOT EXISTS idx_employees_user_id 
  ON employees(user_id);

-- 7. 트리거 함수 정리
-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- daily_sales_summary에 트리거 적용
DROP TRIGGER IF EXISTS update_daily_sales_summary_updated_at ON daily_sales_summary;
CREATE TRIGGER update_daily_sales_summary_updated_at
  BEFORE UPDATE ON daily_sales_summary
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 마이그레이션 완료
-- =============================================