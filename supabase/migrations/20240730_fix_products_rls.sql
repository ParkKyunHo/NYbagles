-- Products 테이블 RLS 정책 수정
-- 기존 정책 삭제
DROP POLICY IF EXISTS "Products are viewable by authenticated users" ON products;
DROP POLICY IF EXISTS "Products can be created by managers and admins" ON products;
DROP POLICY IF EXISTS "Products can be updated by managers and admins" ON products;
DROP POLICY IF EXISTS "Products can be deleted by managers and admins" ON products;

-- 새로운 정책 생성
-- 1. 모든 인증된 사용자가 활성화된 상품을 볼 수 있음
CREATE POLICY "Authenticated users can view active products"
ON products FOR SELECT
TO authenticated
USING (is_active = true);

-- 2. 관리자와 매니저가 모든 상품을 볼 수 있음
CREATE POLICY "Managers and admins can view all products"
ON products FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin', 'manager')
  )
);

-- 3. 관리자만 상품을 생성할 수 있음
CREATE POLICY "Only admins can create products"
ON products FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin')
  )
);

-- 4. 관리자만 상품을 수정할 수 있음
CREATE POLICY "Only admins can update products"
ON products FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin')
  )
);

-- 5. 관리자만 상품을 삭제할 수 있음 (soft delete)
CREATE POLICY "Only admins can delete products"
ON products FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin')
  )
);

-- Product Categories 테이블 RLS 정책
DROP POLICY IF EXISTS "Product categories are viewable by all" ON product_categories;
DROP POLICY IF EXISTS "Product categories can be managed by admins" ON product_categories;

-- 1. 모든 인증된 사용자가 활성화된 카테고리를 볼 수 있음
CREATE POLICY "Authenticated users can view active categories"
ON product_categories FOR SELECT
TO authenticated
USING (is_active = true);

-- 2. 관리자가 모든 카테고리를 관리할 수 있음
CREATE POLICY "Admins can manage all categories"
ON product_categories FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin')
  )
);

-- Store Products 테이블 RLS 정책
DROP POLICY IF EXISTS "Store products are viewable by store members" ON store_products;
DROP POLICY IF EXISTS "Store products can be managed by managers" ON store_products;

-- 1. 매장 직원이 자신의 매장 상품을 볼 수 있음
CREATE POLICY "Store members can view their store products"
ON store_products FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.store_id = store_products.store_id
  )
);

-- 2. 매니저와 관리자가 자신의 매장 상품을 관리할 수 있음
CREATE POLICY "Managers can manage their store products"
ON store_products FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.store_id = store_products.store_id
    AND profiles.role IN ('manager', 'admin', 'super_admin')
  )
);

-- 3. 슈퍼 관리자는 모든 매장 상품을 관리할 수 있음
CREATE POLICY "Super admins can manage all store products"
ON store_products FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'super_admin'
  )
);