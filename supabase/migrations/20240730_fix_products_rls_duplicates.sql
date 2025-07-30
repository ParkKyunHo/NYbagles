-- 중복된 RLS 정책 제거 및 정리

-- 1. 기존 중복 정책 삭제
DROP POLICY IF EXISTS "Anyone can view active products" ON products;
DROP POLICY IF EXISTS "Admins can manage products" ON products;

-- 2. product_categories의 중복 정책 삭제
DROP POLICY IF EXISTS "product_categories_manage_admin" ON product_categories;
DROP POLICY IF EXISTS "product_categories_read_all" ON product_categories;

-- 3. 정리된 RLS 정책 재정의
-- products 테이블 정책 (기존 정책 유지, 중복 제거)
-- "Authenticated users can view active products" - 유지
-- "Managers and admins can view all products" - 유지
-- "Only admins can create products" - 유지
-- "Only admins can update products" - 유지
-- "Only admins can delete products" - 유지

-- 4. product_categories 테이블 정책 정리
-- "Authenticated users can view active categories" - 유지
-- "Admins can manage all categories" - 유지

-- 5. NULL category_id를 가진 상품들에 기본 카테고리 할당
-- 먼저 기본 카테고리가 있는지 확인하고 없으면 생성
DO $$
DECLARE
    default_category_id uuid;
BEGIN
    -- 기존 베이글 카테고리 찾기
    SELECT id INTO default_category_id
    FROM product_categories
    WHERE name = '베이글' AND is_active = true
    LIMIT 1;
    
    -- 없으면 생성
    IF default_category_id IS NULL THEN
        INSERT INTO product_categories (name, description, is_active, display_order)
        VALUES ('베이글', '기본 베이글 카테고리', true, 1)
        RETURNING id INTO default_category_id;
    END IF;
    
    -- NULL category_id를 가진 상품들 업데이트
    UPDATE products
    SET category_id = default_category_id
    WHERE category_id IS NULL;
END $$;

-- 6. store_products에 누락된 상품들 추가 (기존 트리거가 놓친 것들)
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
    )
ON CONFLICT (store_id, product_id) DO NOTHING;