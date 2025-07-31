# 새로운 상품 관리 시스템 마이그레이션 가이드

## 🚀 빠른 실행 가이드

### 1단계: Supabase 대시보드 접속
1. https://supabase.com 로그인
2. 프로젝트 선택
3. 왼쪽 메뉴에서 **SQL Editor** 클릭

### 2단계: SQL 실행
아래 SQL을 복사하여 SQL Editor에 붙여넣고 **Run** 버튼 클릭:

```sql
-- Phase 1: Create new simplified tables structure

-- 1. Create simplified products table
CREATE TABLE IF NOT EXISTS products_v2 (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '베이글',
  price DECIMAL(10,2) NOT NULL,
  stock_quantity INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create sales table
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products_v2(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  sold_at TIMESTAMPTZ DEFAULT NOW(),
  sold_by UUID REFERENCES auth.users(id)
);

-- 3. Create daily closing table
CREATE TABLE IF NOT EXISTS daily_closing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  closing_date DATE NOT NULL,
  product_id UUID REFERENCES products_v2(id) ON DELETE CASCADE,
  opening_stock INTEGER NOT NULL,
  closing_stock INTEGER NOT NULL,
  total_sold INTEGER NOT NULL,
  total_revenue DECIMAL(10,2) NOT NULL,
  closed_by UUID REFERENCES auth.users(id),
  closed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, closing_date, product_id)
);

-- 4. Add indexes for performance
CREATE INDEX idx_products_v2_store_id ON products_v2(store_id);
CREATE INDEX idx_sales_store_id ON sales(store_id);
CREATE INDEX idx_sales_product_id ON sales(product_id);
CREATE INDEX idx_sales_sold_at ON sales(sold_at);
CREATE INDEX idx_daily_closing_store_date ON daily_closing(store_id, closing_date);

-- 5. Enable RLS on new tables
ALTER TABLE products_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_closing ENABLE ROW LEVEL SECURITY;

-- 6. Create simple RLS policies for products_v2
CREATE POLICY "Anyone can view products" ON products_v2
  FOR SELECT USING (true);

CREATE POLICY "Managers can manage products" ON products_v2
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin', 'manager')
    )
  );

-- 7. Create RLS policies for sales
CREATE POLICY "View own store sales" ON sales
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

CREATE POLICY "Create sales for own store" ON sales
  FOR INSERT WITH CHECK (
    store_id IN (
      SELECT store_id FROM employees WHERE user_id = auth.uid()
    )
  );

-- 8. Create RLS policies for daily_closing
CREATE POLICY "View own store closings" ON daily_closing
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

CREATE POLICY "Managers can create closings" ON daily_closing
  FOR INSERT WITH CHECK (
    store_id IN (
      SELECT store_id FROM employees 
      WHERE user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin', 'manager')
    )
  );

-- 9. Migrate existing data (if any)
-- Insert products from existing products table
INSERT INTO products_v2 (id, store_id, name, category, price, stock_quantity, is_active, created_at)
SELECT 
  p.id,
  sp.store_id,
  p.name,
  COALESCE(pc.name, '베이글') as category,
  p.price,
  sp.stock_quantity,
  p.is_active,
  p.created_at
FROM products p
LEFT JOIN store_products sp ON p.id = sp.product_id
LEFT JOIN product_categories pc ON p.category_id = pc.id
WHERE sp.store_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- 10. Create functions for stock management
CREATE OR REPLACE FUNCTION update_product_stock_after_sale()
RETURNS TRIGGER AS $$
BEGIN
  -- Decrease stock quantity
  UPDATE products_v2
  SET stock_quantity = stock_quantity - NEW.quantity
  WHERE id = NEW.product_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. Create trigger for automatic stock update
CREATE TRIGGER auto_update_stock_after_sale
AFTER INSERT ON sales
FOR EACH ROW
EXECUTE FUNCTION update_product_stock_after_sale();
```

### 3단계: 실행 확인
SQL 실행 후 다음을 확인:
- ✅ "Success. No rows returned" 메시지
- ✅ 좌측 Table Editor에서 새 테이블 확인:
  - products_v2
  - sales
  - daily_closing

### 4단계: 테스트
1. 브라우저에서 사이트 접속
2. **⚡ 간편 상품관리** 메뉴에서 상품 추가
3. **⚡ 간편 판매** 메뉴에서 판매 테스트
4. **⚡ 일일 마감** 메뉴에서 매출 확인

## ❓ 문제 발생 시

### 오류: "relation already exists"
- 이미 테이블이 생성되어 있음
- 정상적인 상황이므로 무시하고 진행

### 오류: "permission denied"
- Supabase 프로젝트 소유자 계정으로 로그인 확인
- Database 권한 확인

### 데이터가 안 보일 때
1. 기존 상품이 있었다면 자동 마이그레이션됨
2. 없다면 **⚡ 간편 상품관리**에서 새로 추가

## 📞 지원
문제가 지속되면 다음 정보와 함께 문의:
- 오류 메시지 스크린샷
- 실행한 SQL 부분
- Supabase 프로젝트 ID