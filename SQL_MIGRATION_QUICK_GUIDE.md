# 🚀 SQL 마이그레이션 빠른 실행 가이드

## 1분 안에 새 시스템 적용하기

### 🔗 빠른 링크
1. Supabase 프로젝트 바로가기: https://supabase.com/dashboard/project/plvimwcptvbxvjwqxmpf
2. SQL Editor 바로가기: https://supabase.com/dashboard/project/plvimwcptvbxvjwqxmpf/sql/new

### 📋 복사할 SQL (전체 복사)

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

### 🎯 실행 단계 (3단계만!)

1. **SQL Editor 열기**
   - 위 링크 클릭 또는
   - Supabase 대시보드 → SQL Editor

2. **SQL 붙여넣고 실행**
   - 위 SQL 전체 복사
   - SQL Editor에 붙여넣기
   - **RUN** 버튼 클릭 (우측 하단 녹색 버튼)

3. **확인**
   - "Success. No rows returned" 메시지 확인
   - 좌측 메뉴 Table Editor에서 새 테이블 확인:
     - products_v2 ✅
     - sales ✅
     - daily_closing ✅

### ✨ 완료! 이제 사용 가능합니다
- https://nybagles.vercel.app 접속
- ⚡ 간편 판매 메뉴 사용 가능
- ⚡ 간편 상품관리 메뉴 사용 가능
- ⚡ 일일 마감 메뉴 사용 가능

### ❓ 문제가 있나요?
- "relation already exists" 오류 → 이미 생성됨, 정상!
- 다른 오류 → 스크린샷 찍어서 문의