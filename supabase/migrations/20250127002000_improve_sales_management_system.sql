-- 판매 관리 시스템 개선
-- 기존 sales_records 테이블을 확장하고 관련 기능 추가

-- sales_records 테이블에 매장 정보 추가
ALTER TABLE sales_records 
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE RESTRICT,
ADD COLUMN IF NOT EXISTS payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'transfer', 'mobile', 'other')) DEFAULT 'cash',
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS is_canceled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS canceled_by UUID REFERENCES profiles(id);

-- 기존 레코드에 매장 정보 추가 (recorded_by의 employee 정보에서 가져오기)
UPDATE sales_records sr
SET store_id = (
  SELECT e.store_id 
  FROM employees e 
  WHERE e.user_id = sr.recorded_by
  LIMIT 1
)
WHERE sr.store_id IS NULL;

-- store_id를 NOT NULL로 변경
ALTER TABLE sales_records 
ALTER COLUMN store_id SET NOT NULL;

-- 판매 상세 테이블 생성 (여러 상품을 한 번에 판매하는 경우)
CREATE TABLE IF NOT EXISTS sales_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID NOT NULL REFERENCES sales_records(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
  total_amount DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  discount_amount DECIMAL(10,2) DEFAULT 0 CHECK (discount_amount >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 일일 매출 집계 테이블
CREATE TABLE IF NOT EXISTS daily_sales_summary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  sale_date DATE NOT NULL,
  total_sales DECIMAL(12,2) DEFAULT 0,
  cash_sales DECIMAL(12,2) DEFAULT 0,
  card_sales DECIMAL(12,2) DEFAULT 0,
  other_sales DECIMAL(12,2) DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  canceled_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, sale_date)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_sales_records_store_date ON sales_records(store_id, sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_records_recorded_by ON sales_records(recorded_by);
CREATE INDEX IF NOT EXISTS idx_sales_items_sale_id ON sales_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_items_product_id ON sales_items(product_id);
CREATE INDEX IF NOT EXISTS idx_daily_sales_summary_store_date ON daily_sales_summary(store_id, sale_date);

-- 판매 기록 생성 함수
CREATE OR REPLACE FUNCTION create_sales_record(
  p_store_id UUID,
  p_items JSONB, -- [{product_id, quantity, unit_price, discount_amount}]
  p_payment_method TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_sale_id UUID;
  v_total_amount DECIMAL(12,2) := 0;
  v_item JSONB;
BEGIN
  -- 판매 기록 생성
  INSERT INTO sales_records (
    store_id, 
    recorded_by, 
    sale_date, 
    sale_time, 
    payment_method, 
    notes, 
    quantity, 
    unit_price, 
    total_amount
  )
  VALUES (
    p_store_id,
    auth.uid(),
    CURRENT_DATE,
    CURRENT_TIME,
    p_payment_method,
    p_notes,
    1, -- 임시값, 나중에 업데이트
    0, -- 임시값
    0  -- 임시값
  )
  RETURNING id INTO v_sale_id;

  -- 판매 상세 항목 추가
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO sales_items (
      sale_id,
      product_id,
      quantity,
      unit_price,
      discount_amount
    )
    VALUES (
      v_sale_id,
      (v_item->>'product_id')::UUID,
      (v_item->>'quantity')::INTEGER,
      (v_item->>'unit_price')::DECIMAL,
      COALESCE((v_item->>'discount_amount')::DECIMAL, 0)
    );
    
    v_total_amount := v_total_amount + 
      ((v_item->>'quantity')::INTEGER * (v_item->>'unit_price')::DECIMAL) - 
      COALESCE((v_item->>'discount_amount')::DECIMAL, 0);
  END LOOP;

  -- 판매 기록의 총액 업데이트
  UPDATE sales_records 
  SET total_amount = v_total_amount,
      quantity = (SELECT SUM(quantity) FROM sales_items WHERE sale_id = v_sale_id),
      unit_price = v_total_amount / NULLIF((SELECT SUM(quantity) FROM sales_items WHERE sale_id = v_sale_id), 0)
  WHERE id = v_sale_id;

  -- 일일 매출 집계 업데이트
  PERFORM update_daily_sales_summary(p_store_id, CURRENT_DATE);

  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 일일 매출 집계 업데이트 함수
CREATE OR REPLACE FUNCTION update_daily_sales_summary(
  p_store_id UUID,
  p_date DATE
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO daily_sales_summary (
    store_id, 
    sale_date, 
    total_sales,
    cash_sales,
    card_sales,
    other_sales,
    transaction_count,
    canceled_count
  )
  SELECT 
    p_store_id,
    p_date,
    COALESCE(SUM(CASE WHEN NOT is_canceled THEN total_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_method = 'cash' AND NOT is_canceled THEN total_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_method = 'card' AND NOT is_canceled THEN total_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_method NOT IN ('cash', 'card') AND NOT is_canceled THEN total_amount ELSE 0 END), 0),
    COUNT(CASE WHEN NOT is_canceled THEN 1 END),
    COUNT(CASE WHEN is_canceled THEN 1 END)
  FROM sales_records
  WHERE store_id = p_store_id AND sale_date = p_date
  ON CONFLICT (store_id, sale_date) 
  DO UPDATE SET
    total_sales = EXCLUDED.total_sales,
    cash_sales = EXCLUDED.cash_sales,
    card_sales = EXCLUDED.card_sales,
    other_sales = EXCLUDED.other_sales,
    transaction_count = EXCLUDED.transaction_count,
    canceled_count = EXCLUDED.canceled_count,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 판매 취소 함수
CREATE OR REPLACE FUNCTION cancel_sales_record(
  p_sale_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_store_id UUID;
  v_sale_date DATE;
BEGIN
  -- 판매 기록 취소
  UPDATE sales_records 
  SET is_canceled = true,
      canceled_at = NOW(),
      canceled_by = auth.uid(),
      notes = COALESCE(notes || E'\n', '') || '취소 사유: ' || COALESCE(p_reason, '사용자 요청')
  WHERE id = p_sale_id AND NOT is_canceled
  RETURNING store_id, sale_date INTO v_store_id, v_sale_date;

  IF v_store_id IS NULL THEN
    RETURN false;
  END IF;

  -- 일일 매출 집계 업데이트
  PERFORM update_daily_sales_summary(v_store_id, v_sale_date);

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 매출 통계 뷰
CREATE OR REPLACE VIEW sales_statistics AS
SELECT 
  s.id as store_id,
  s.name as store_name,
  DATE_TRUNC('month', sr.sale_date) as month,
  COUNT(DISTINCT sr.sale_date) as sale_days,
  COUNT(sr.id) as transaction_count,
  SUM(CASE WHEN NOT sr.is_canceled THEN sr.total_amount ELSE 0 END) as total_sales,
  AVG(CASE WHEN NOT sr.is_canceled THEN sr.total_amount ELSE NULL END) as avg_transaction,
  SUM(CASE WHEN sr.payment_method = 'cash' AND NOT sr.is_canceled THEN sr.total_amount ELSE 0 END) as cash_sales,
  SUM(CASE WHEN sr.payment_method = 'card' AND NOT sr.is_canceled THEN sr.total_amount ELSE 0 END) as card_sales
FROM stores s
LEFT JOIN sales_records sr ON s.id = sr.store_id
GROUP BY s.id, s.name, DATE_TRUNC('month', sr.sale_date);

-- 인기 상품 뷰
CREATE OR REPLACE VIEW popular_products AS
SELECT 
  si.product_id,
  p.name as product_name,
  p.category_id,
  pc.name as category_name,
  sr.store_id,
  s.name as store_name,
  DATE_TRUNC('month', sr.sale_date) as month,
  SUM(si.quantity) as total_quantity,
  SUM(si.total_amount) as total_revenue,
  COUNT(DISTINCT sr.id) as transaction_count
FROM sales_items si
JOIN sales_records sr ON si.sale_id = sr.id
JOIN products p ON si.product_id = p.id
JOIN product_categories pc ON p.category_id = pc.id
JOIN stores s ON sr.store_id = s.id
WHERE NOT sr.is_canceled
GROUP BY si.product_id, p.name, p.category_id, pc.name, sr.store_id, s.name, DATE_TRUNC('month', sr.sale_date)
ORDER BY total_quantity DESC;

-- RLS 정책
ALTER TABLE sales_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_sales_summary ENABLE ROW LEVEL SECURITY;

-- sales_records RLS 정책
CREATE POLICY "직원은 자기 매장의 판매 기록만 조회" ON sales_records
  FOR SELECT USING (
    auth.uid() IN (
      SELECT e.user_id FROM employees e 
      WHERE e.store_id = sales_records.store_id
    )
    OR
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "직원은 자기 매장에 판매 기록 생성" ON sales_records
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT e.user_id FROM employees e 
      WHERE e.store_id = sales_records.store_id
    )
  );

CREATE POLICY "매니저 이상만 판매 기록 수정" ON sales_records
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT p.id FROM profiles p
      JOIN employees e ON p.id = e.user_id
      WHERE e.store_id = sales_records.store_id
      AND p.role IN ('super_admin', 'admin', 'manager')
    )
  );

-- sales_items RLS 정책
CREATE POLICY "sales_items 조회는 sales_records 권한을 따름" ON sales_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sales_records sr 
      WHERE sr.id = sales_items.sale_id
      AND (
        auth.uid() IN (
          SELECT e.user_id FROM employees e 
          WHERE e.store_id = sr.store_id
        )
        OR
        auth.uid() IN (
          SELECT id FROM profiles WHERE role IN ('super_admin', 'admin')
        )
      )
    )
  );

CREATE POLICY "sales_items 생성은 sales_records 권한을 따름" ON sales_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_records sr 
      WHERE sr.id = sales_items.sale_id
      AND auth.uid() IN (
        SELECT e.user_id FROM employees e 
        WHERE e.store_id = sr.store_id
      )
    )
  );

-- daily_sales_summary RLS 정책
CREATE POLICY "일일 매출 집계는 매니저 이상만 조회" ON daily_sales_summary
  FOR SELECT USING (
    auth.uid() IN (
      SELECT p.id FROM profiles p
      JOIN employees e ON p.id = e.user_id
      WHERE e.store_id = daily_sales_summary.store_id
      AND p.role IN ('super_admin', 'admin', 'manager')
    )
  );

-- 인기 상품 조회 함수
CREATE OR REPLACE FUNCTION get_popular_products(
  p_store_id UUID DEFAULT NULL,
  p_category_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  category_id UUID,
  category_name TEXT,
  unit TEXT,
  default_price DECIMAL,
  total_quantity BIGINT,
  total_revenue DECIMAL,
  transaction_count BIGINT,
  avg_price DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    si.product_id,
    p.name::TEXT as product_name,
    p.category_id,
    pc.name::TEXT as category_name,
    p.unit::TEXT,
    p.price as default_price,
    SUM(si.quantity)::BIGINT as total_quantity,
    SUM(si.total_amount)::DECIMAL as total_revenue,
    COUNT(DISTINCT sr.id)::BIGINT as transaction_count,
    AVG(si.unit_price)::DECIMAL as avg_price
  FROM sales_items si
  JOIN sales_records sr ON si.sale_id = sr.id
  JOIN products p ON si.product_id = p.id
  JOIN product_categories pc ON p.category_id = pc.id
  WHERE NOT sr.is_canceled
    AND (p_store_id IS NULL OR sr.store_id = p_store_id)
    AND (p_category_id IS NULL OR p.category_id = p_category_id)
    AND (p_start_date IS NULL OR sr.sale_date >= p_start_date)
  GROUP BY si.product_id, p.name, p.category_id, pc.name, p.unit, p.price
  ORDER BY total_quantity DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 권한 부여
GRANT SELECT ON sales_statistics TO authenticated;
GRANT SELECT ON popular_products TO authenticated;
GRANT EXECUTE ON FUNCTION create_sales_record TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_sales_record TO authenticated;
GRANT EXECUTE ON FUNCTION get_popular_products TO authenticated;