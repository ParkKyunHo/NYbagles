-- =====================================================
-- 상품 관리 시스템 v3 - 승인 워크플로우 구현
-- =====================================================

-- 1. 상품 마스터 테이블 (승인 상태 포함)
CREATE TABLE IF NOT EXISTS products_v3 (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  
  -- 기본 정보
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT '베이글',
  
  -- 가격 정보
  base_price DECIMAL(10,2) NOT NULL,
  sale_price DECIMAL(10,2),
  
  -- 재고 정보
  stock_quantity INTEGER DEFAULT 0,
  min_stock_level INTEGER DEFAULT 5,
  max_stock_level INTEGER DEFAULT 100,
  
  -- 상태 관리
  status TEXT NOT NULL DEFAULT 'draft' 
    CHECK (status IN ('draft', 'pending_approval', 'approved', 'active', 'inactive', 'archived')),
  
  -- 메타데이터
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 인덱스
  UNIQUE(store_id, sku)
);

-- 2. 상품 변경 이력 및 승인 워크플로우
CREATE TABLE IF NOT EXISTS product_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products_v3(id) ON DELETE CASCADE,
  
  -- 변경 정보
  change_type TEXT NOT NULL CHECK (change_type IN ('create', 'update', 'delete', 'price_change', 'stock_adjustment')),
  old_values JSONB,
  new_values JSONB NOT NULL,
  change_reason TEXT,
  
  -- 승인 워크플로우
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  
  -- 승인자 정보
  requested_by UUID REFERENCES auth.users(id) NOT NULL,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_comment TEXT,
  
  -- 자동 승인 규칙
  auto_approve_threshold DECIMAL(10,2), -- 가격 변경 임계값
  requires_manager_approval BOOLEAN DEFAULT true,
  
  CONSTRAINT valid_review CHECK (
    (status = 'pending' AND reviewed_by IS NULL) OR
    (status != 'pending' AND reviewed_by IS NOT NULL)
  )
);

-- 3. 상품 감사 로그 (pgaudit 스타일)
CREATE TABLE IF NOT EXISTS product_audit_log (
  id BIGSERIAL PRIMARY KEY,
  audit_timestamp TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID,
  user_email TEXT,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT
);

-- 4. 판매 트랜잭션 (불변 레코드)
CREATE TABLE IF NOT EXISTS sales_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_number TEXT NOT NULL UNIQUE,
  store_id UUID REFERENCES stores(id) ON DELETE RESTRICT,
  
  -- 트랜잭션 정보
  transaction_type TEXT NOT NULL DEFAULT 'sale' 
    CHECK (transaction_type IN ('sale', 'return', 'exchange', 'void')),
  
  -- 금액 정보
  subtotal DECIMAL(10,2) NOT NULL,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  
  -- 결제 정보
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'completed'
    CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
  
  -- 메타데이터
  sold_by UUID REFERENCES auth.users(id) NOT NULL,
  sold_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 관련 트랜잭션 (반품/교환용)
  parent_transaction_id UUID REFERENCES sales_transactions(id)
);

-- 5. 판매 상세 항목
CREATE TABLE IF NOT EXISTS sales_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID REFERENCES sales_transactions(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products_v3(id) ON DELETE RESTRICT,
  
  -- 판매 정보
  quantity INTEGER NOT NULL CHECK (quantity != 0),
  unit_price DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  
  -- 재고 스냅샷 (판매 시점)
  stock_before INTEGER NOT NULL,
  stock_after INTEGER NOT NULL,
  
  -- 메타데이터
  notes TEXT,
  
  CONSTRAINT valid_stock CHECK (
    (quantity > 0 AND stock_after = stock_before - quantity) OR
    (quantity < 0 AND stock_after = stock_before - quantity) -- 반품
  )
);

-- 6. 재고 이동 추적
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products_v3(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  
  -- 이동 정보
  movement_type TEXT NOT NULL 
    CHECK (movement_type IN ('sale', 'return', 'adjustment', 'transfer', 'damage', 'receive')),
  quantity INTEGER NOT NULL,
  
  -- 참조
  reference_type TEXT,
  reference_id UUID,
  
  -- 재고 스냅샷
  stock_before INTEGER NOT NULL,
  stock_after INTEGER NOT NULL,
  
  -- 메타데이터
  reason TEXT,
  performed_by UUID REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_products_v3_store_id ON products_v3(store_id);
CREATE INDEX idx_products_v3_status ON products_v3(status);
CREATE INDEX idx_product_changes_status ON product_changes(status);
CREATE INDEX idx_product_changes_product_id ON product_changes(product_id);
CREATE INDEX idx_sales_transactions_store_date ON sales_transactions(store_id, sold_at DESC);
CREATE INDEX idx_sales_transactions_number ON sales_transactions(transaction_number);
CREATE INDEX idx_sales_items_transaction_id ON sales_items(transaction_id);
CREATE INDEX idx_sales_items_product_id ON sales_items(product_id);
CREATE INDEX idx_inventory_movements_product ON inventory_movements(product_id, performed_at DESC);

-- RLS 활성화
ALTER TABLE products_v3 ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- RLS 정책 - 상품 조회
CREATE POLICY "products_v3_select" ON products_v3
  FOR SELECT USING (
    -- 모든 직원은 자기 매장 상품 조회 가능
    store_id IN (
      SELECT store_id FROM employees WHERE user_id = auth.uid()
    )
    OR 
    -- 관리자는 모든 상품 조회
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- RLS 정책 - 상품 변경 요청
CREATE POLICY "product_changes_insert" ON product_changes
  FOR INSERT WITH CHECK (
    requested_by = auth.uid()
    AND (
      -- 매니저 이상만 상품 변경 요청 가능
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'admin', 'manager')
      )
    )
  );

-- RLS 정책 - 상품 변경 조회
CREATE POLICY "product_changes_select" ON product_changes
  FOR SELECT USING (
    -- 요청자 본인
    requested_by = auth.uid()
    OR
    -- 승인자 권한
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin', 'manager')
    )
  );

-- RLS 정책 - 상품 변경 승인
CREATE POLICY "product_changes_approve" ON product_changes
  FOR UPDATE USING (
    status = 'pending'
    AND reviewed_by IS NULL
    AND (
      -- 관리자는 모든 요청 승인 가능
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'admin')
      )
      OR
      -- 매니저는 자기 매장 요청만 승인
      (
        EXISTS (
          SELECT 1 FROM profiles 
          WHERE id = auth.uid() 
          AND role = 'manager'
        )
        AND product_id IN (
          SELECT id FROM products_v3 
          WHERE store_id IN (
            SELECT store_id FROM employees WHERE user_id = auth.uid()
          )
        )
      )
    )
  );

-- RLS 정책 - 판매 트랜잭션
CREATE POLICY "sales_transactions_select" ON sales_transactions
  FOR SELECT USING (
    store_id IN (
      SELECT store_id FROM employees WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "sales_transactions_insert" ON sales_transactions
  FOR INSERT WITH CHECK (
    store_id IN (
      SELECT store_id FROM employees WHERE user_id = auth.uid()
    )
    AND sold_by = auth.uid()
  );

-- 트랜잭션 번호 시퀀스
CREATE SEQUENCE IF NOT EXISTS transaction_seq;

-- 트리거 함수 - 트랜잭션 번호 생성
CREATE OR REPLACE FUNCTION generate_transaction_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.transaction_number := 
    TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
    LPAD(nextval('transaction_seq')::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_transaction_number
BEFORE INSERT ON sales_transactions
FOR EACH ROW
EXECUTE FUNCTION generate_transaction_number();

-- 트리거 함수 - 상품 변경 승인 처리
CREATE OR REPLACE FUNCTION process_product_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- 승인된 경우만 처리
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    -- 상품 업데이트
    IF NEW.change_type = 'create' THEN
      UPDATE products_v3 
      SET 
        status = 'active',
        updated_by = NEW.reviewed_by,
        updated_at = NOW()
      WHERE id = NEW.product_id;
    ELSE
      -- 기존 값과 새 값 병합
      UPDATE products_v3 p
      SET 
        name = COALESCE((NEW.new_values->>'name')::TEXT, p.name),
        description = COALESCE((NEW.new_values->>'description')::TEXT, p.description),
        base_price = COALESCE((NEW.new_values->>'base_price')::DECIMAL, p.base_price),
        sale_price = COALESCE((NEW.new_values->>'sale_price')::DECIMAL, p.sale_price),
        category = COALESCE((NEW.new_values->>'category')::TEXT, p.category),
        stock_quantity = COALESCE((NEW.new_values->>'stock_quantity')::INTEGER, p.stock_quantity),
        updated_by = NEW.reviewed_by,
        updated_at = NOW()
      WHERE id = NEW.product_id;
    END IF;
    
    -- 감사 로그 생성
    INSERT INTO product_audit_log (
      user_id, action, table_name, record_id, 
      old_data, new_data
    ) VALUES (
      NEW.reviewed_by, 'APPROVE', 'product_changes', NEW.id,
      row_to_json(OLD), row_to_json(NEW)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_process_approval
AFTER UPDATE ON product_changes
FOR EACH ROW
EXECUTE FUNCTION process_product_approval();

-- 트리거 함수 - 재고 이동 자동 기록
CREATE OR REPLACE FUNCTION track_inventory_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_movement_type TEXT;
  v_reference_id UUID;
BEGIN
  -- 판매 항목 생성 시 재고 이동 기록
  IF TG_TABLE_NAME = 'sales_items' THEN
    v_movement_type := CASE 
      WHEN NEW.quantity > 0 THEN 'sale'
      ELSE 'return'
    END;
    v_reference_id := NEW.transaction_id;
    
    INSERT INTO inventory_movements (
      product_id, store_id, movement_type, quantity,
      reference_type, reference_id,
      stock_before, stock_after,
      performed_by
    )
    SELECT 
      NEW.product_id,
      s.store_id,
      v_movement_type,
      NEW.quantity,
      'sales_transaction',
      v_reference_id,
      NEW.stock_before,
      NEW.stock_after,
      s.sold_by
    FROM sales_transactions s
    WHERE s.id = NEW.transaction_id;
    
    -- 상품 재고 업데이트
    UPDATE products_v3
    SET stock_quantity = NEW.stock_after
    WHERE id = NEW.product_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_track_inventory
AFTER INSERT ON sales_items
FOR EACH ROW
EXECUTE FUNCTION track_inventory_movement();

-- 실시간 판매 분석 뷰
CREATE MATERIALIZED VIEW IF NOT EXISTS sales_analytics AS
SELECT 
  s.store_id,
  DATE_TRUNC('hour', s.sold_at) as hour,
  COUNT(DISTINCT s.id) as transaction_count,
  COUNT(si.id) as items_sold,
  SUM(si.quantity) as total_quantity,
  SUM(s.total_amount) as revenue,
  AVG(s.total_amount) as avg_transaction_value,
  
  -- 상품별 집계
  JSONB_AGG(
    JSONB_BUILD_OBJECT(
      'product_id', si.product_id,
      'quantity', si.quantity,
      'revenue', si.total_amount
    ) ORDER BY si.total_amount DESC
  ) as top_products
  
FROM sales_transactions s
JOIN sales_items si ON s.id = si.transaction_id
WHERE s.payment_status = 'completed'
GROUP BY s.store_id, DATE_TRUNC('hour', s.sold_at);

-- 재고 현황 뷰
CREATE OR REPLACE VIEW inventory_status AS
SELECT 
  p.id,
  p.store_id,
  p.sku,
  p.name,
  p.category,
  p.stock_quantity,
  p.min_stock_level,
  p.max_stock_level,
  
  -- 재고 상태
  CASE 
    WHEN p.stock_quantity <= 0 THEN 'out_of_stock'
    WHEN p.stock_quantity < p.min_stock_level THEN 'low_stock'
    WHEN p.stock_quantity > p.max_stock_level THEN 'overstock'
    ELSE 'normal'
  END as stock_status,
  
  -- 최근 판매 속도
  COALESCE(recent.velocity, 0) as sales_velocity,
  
  -- 예상 소진 일수
  CASE 
    WHEN COALESCE(recent.velocity, 0) > 0 
    THEN p.stock_quantity / recent.velocity
    ELSE NULL
  END as days_until_stockout
  
FROM products_v3 p
LEFT JOIN LATERAL (
  SELECT 
    AVG(ABS(quantity))::DECIMAL as velocity
  FROM inventory_movements
  WHERE product_id = p.id
    AND movement_type IN ('sale', 'return')
    AND performed_at > NOW() - INTERVAL '7 days'
) recent ON true
WHERE p.status = 'active';

-- 기존 데이터 마이그레이션 (products_v2 → products_v3)
INSERT INTO products_v3 (
  store_id, sku, name, category, 
  base_price, stock_quantity, status,
  created_at
)
SELECT 
  store_id,
  'SKU-' || SUBSTRING(id::TEXT, 1, 8) as sku,
  name,
  category,
  price as base_price,
  stock_quantity,
  'active' as status,
  created_at
FROM products_v2
WHERE is_active = true
ON CONFLICT (store_id, sku) DO NOTHING;