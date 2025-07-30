-- 새 상품이 추가될 때 모든 매장에 자동으로 store_products 레코드 생성하는 트리거
CREATE OR REPLACE FUNCTION auto_create_store_products()
RETURNS TRIGGER AS $$
BEGIN
  -- 모든 활성 매장에 대해 store_products 레코드 생성
  INSERT INTO store_products (store_id, product_id, custom_price, is_available, stock_quantity)
  SELECT 
    s.id as store_id,
    NEW.id as product_id,
    NEW.price as custom_price,  -- 기본 가격으로 설정
    true as is_available,
    100 as stock_quantity  -- 기본 재고
  FROM stores s
  WHERE s.is_active = true
  ON CONFLICT (store_id, product_id) DO NOTHING;  -- 이미 있으면 무시
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거 삭제 (있을 경우)
DROP TRIGGER IF EXISTS create_store_products_on_new_product ON products;

-- 새 트리거 생성
CREATE TRIGGER create_store_products_on_new_product
AFTER INSERT ON products
FOR EACH ROW
EXECUTE FUNCTION auto_create_store_products();

-- 기존 상품들에 대해 누락된 store_products 레코드 생성
INSERT INTO store_products (store_id, product_id, custom_price, is_available, stock_quantity)
SELECT 
  s.id as store_id,
  p.id as product_id,
  p.price as custom_price,
  true as is_available,
  100 as stock_quantity
FROM stores s
CROSS JOIN products p
WHERE s.is_active = true
  AND p.is_active = true
  AND NOT EXISTS (
    SELECT 1 
    FROM store_products sp 
    WHERE sp.store_id = s.id 
      AND sp.product_id = p.id
  );

-- 매장이 추가될 때 모든 상품에 대한 store_products 레코드 생성하는 트리거
CREATE OR REPLACE FUNCTION auto_create_products_for_store()
RETURNS TRIGGER AS $$
BEGIN
  -- 활성 매장이면 모든 활성 상품에 대해 store_products 레코드 생성
  IF NEW.is_active = true THEN
    INSERT INTO store_products (store_id, product_id, custom_price, is_available, stock_quantity)
    SELECT 
      NEW.id as store_id,
      p.id as product_id,
      p.price as custom_price,
      true as is_available,
      100 as stock_quantity
    FROM products p
    WHERE p.is_active = true
    ON CONFLICT (store_id, product_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거 삭제 (있을 경우)
DROP TRIGGER IF EXISTS create_products_on_new_store ON stores;

-- 새 트리거 생성
CREATE TRIGGER create_products_on_new_store
AFTER INSERT ON stores
FOR EACH ROW
EXECUTE FUNCTION auto_create_products_for_store();