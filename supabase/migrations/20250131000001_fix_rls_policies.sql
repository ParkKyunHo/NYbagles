-- Fix RLS Policies for Products and Employee Signup Requests
-- Migration: 20250131000001_fix_rls_policies.sql

-- 1. Fix products table RLS policies
-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view products" ON products;
DROP POLICY IF EXISTS "Admins can manage products" ON products;

-- Create new policies that work for authenticated users
CREATE POLICY "Authenticated users can view products" ON products
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage products" ON products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

-- 2. Fix product_categories table RLS policies
-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view active categories" ON product_categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON product_categories;

-- Create new policies
CREATE POLICY "Authenticated users can view active categories" ON product_categories
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);

CREATE POLICY "Admins can manage categories" ON product_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

-- 3. Fix store_products table RLS policies
-- Drop existing policies
DROP POLICY IF EXISTS "Employees can view store products" ON store_products;
DROP POLICY IF EXISTS "Managers can manage store products" ON store_products;

-- Create new policies
CREATE POLICY "Employees can view store products" ON store_products
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      -- 관리자는 모든 매장 상품 조회 가능
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
      )
      OR
      -- 일반 직원은 자기 매장 상품만 조회
      EXISTS (
        SELECT 1 FROM employees e
        JOIN profiles p ON p.id = e.user_id
        WHERE p.id = auth.uid()
        AND e.store_id = store_products.store_id
      )
    )
  );

CREATE POLICY "Managers can manage store products" ON store_products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN employees e ON e.user_id = p.id
      WHERE p.id = auth.uid() 
      AND (
        p.role IN ('super_admin', 'admin')
        OR (p.role = 'manager' AND e.store_id = store_products.store_id)
      )
    )
  );

-- 4. Fix employee_signup_requests table RLS policies (if exists)
-- First check if the table exists and create policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employee_signup_requests') THEN
    -- Drop existing policies if any
    DROP POLICY IF EXISTS "Managers can view signup requests" ON employee_signup_requests;
    DROP POLICY IF EXISTS "Anyone can insert signup request" ON employee_signup_requests;
    DROP POLICY IF EXISTS "Managers can update signup requests" ON employee_signup_requests;
    
    -- Create new policies
    EXECUTE 'CREATE POLICY "Admins and managers can view signup requests" ON employee_signup_requests
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role IN (''super_admin'', ''admin'', ''manager'')
        )
      )';
    
    EXECUTE 'CREATE POLICY "Anyone can insert signup request" ON employee_signup_requests
      FOR INSERT WITH CHECK (true)';
    
    EXECUTE 'CREATE POLICY "Admins and managers can update signup requests" ON employee_signup_requests
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role IN (''super_admin'', ''admin'', ''manager'')
        )
      )';
  END IF;
END $$;

-- 5. Create a function to debug authentication issues
CREATE OR REPLACE FUNCTION debug_auth_info()
RETURNS TABLE (
  user_id UUID,
  user_email TEXT,
  user_role TEXT,
  is_authenticated BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    auth.uid() as user_id,
    auth.email() as user_email,
    p.role as user_role,
    (auth.uid() IS NOT NULL) as is_authenticated
  FROM profiles p
  WHERE p.id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION debug_auth_info() TO authenticated;

-- 6. Ensure all new products are automatically added to store_products
CREATE OR REPLACE FUNCTION auto_create_store_products()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into store_products for all active stores
  INSERT INTO store_products (store_id, product_id, is_available)
  SELECT s.id, NEW.id, true
  FROM stores s
  WHERE s.is_active = true;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS auto_create_store_products_trigger ON products;

-- Create trigger
CREATE TRIGGER auto_create_store_products_trigger
  AFTER INSERT ON products
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_store_products();

-- 7. Fix any missing store_products entries for existing products
INSERT INTO store_products (store_id, product_id, is_available)
SELECT s.id, p.id, true
FROM stores s
CROSS JOIN products p
WHERE s.is_active = true 
  AND p.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM store_products sp
    WHERE sp.store_id = s.id AND sp.product_id = p.id
  );

-- 8. Add helpful comments
COMMENT ON POLICY "Authenticated users can view products" ON products IS 'All logged-in users can view products';
COMMENT ON POLICY "Admins can manage products" ON products IS 'Only super_admin and admin roles can create, update, or delete products';
COMMENT ON FUNCTION debug_auth_info() IS 'Helper function to debug authentication and authorization issues';