-- 사용되지 않는 products 테이블 정리
-- 현재 products_v3가 실제 사용되는 테이블임

-- 1. 이전 버전의 products 관련 뷰 삭제
DROP VIEW IF EXISTS popular_products CASCADE;
DROP VIEW IF EXISTS sales_statistics CASCADE;

-- 2. 이전 버전의 products 관련 함수 삭제
DROP FUNCTION IF EXISTS get_popular_products CASCADE;
DROP FUNCTION IF EXISTS update_product_stock_after_sale CASCADE;

-- 3. 이전 버전의 트리거 삭제
DROP TRIGGER IF EXISTS auto_update_stock_after_sale ON sales;
DROP TRIGGER IF EXISTS update_products_updated_at ON products;

-- 4. 이전 버전의 테이블 삭제 (의존성 순서대로)
DROP TABLE IF EXISTS price_history CASCADE;
DROP TABLE IF EXISTS store_products CASCADE;
DROP TABLE IF EXISTS sales_items CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS products_v2 CASCADE;
DROP TABLE IF EXISTS product_categories CASCADE;

-- 5. 원본 products 테이블을 products_v3로 이름 변경 또는 삭제
-- 먼저 products 테이블에 데이터가 있는지 확인하고 필요하면 백업
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
    -- products 테이블이 존재하면 백업 후 삭제
    IF EXISTS (SELECT 1 FROM products LIMIT 1) THEN
      -- 데이터가 있으면 백업 테이블 생성
      CREATE TABLE IF NOT EXISTS products_backup AS SELECT * FROM products;
    END IF;
    
    -- products 테이블과 관련된 모든 제약조건 삭제
    ALTER TABLE IF EXISTS sales_records DROP CONSTRAINT IF EXISTS sales_records_product_id_fkey;
    
    -- products 테이블 삭제
    DROP TABLE IF EXISTS products CASCADE;
  END IF;
END $$;

-- 6. products_v3를 products로 이름 변경 (메인 테이블로 사용)
ALTER TABLE IF EXISTS products_v3 RENAME TO products;

-- 7. 관련 인덱스 재생성
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_approval_status ON products(approval_status);

-- 8. sales_records 테이블의 product_id 외래키 재설정
ALTER TABLE sales_records 
  DROP CONSTRAINT IF EXISTS sales_records_product_id_fkey,
  ADD CONSTRAINT sales_records_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

-- 9. 새로운 RLS 정책 확인 및 재생성
DROP POLICY IF EXISTS "Anyone can view products" ON products;
DROP POLICY IF EXISTS "Admins can manage products" ON products;

-- 모든 활성 상품 조회 가능
CREATE POLICY "Anyone can view active products" ON products
  FOR SELECT USING (is_active = true);

-- 관리자는 모든 상품 관리 가능
CREATE POLICY "Admins can manage all products" ON products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

-- 매니저는 자신의 매장 상품만 관리 가능
CREATE POLICY "Managers can manage store products" ON products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN employees e ON p.id = e.user_id
      WHERE p.id = auth.uid() 
      AND p.role = 'manager'
      AND e.store_id = products.store_id
    )
  );

-- 10. 정리 완료 메시지
DO $$
BEGIN
  RAISE NOTICE 'Product tables cleanup completed. Main table is now: products (formerly products_v3)';
END $$;