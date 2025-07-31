-- Fix RLS Policy Conflicts for Product Management
-- Migration: 20250131000002_fix_product_rls_conflicts.sql

-- 1. Clean up duplicate and conflicting policies on products table
DROP POLICY IF EXISTS "Anyone can view products" ON products;
DROP POLICY IF EXISTS "Authenticated users can view products" ON products;
DROP POLICY IF EXISTS "All authenticated users can view products" ON products;
DROP POLICY IF EXISTS "Admins can manage products" ON products;
DROP POLICY IF EXISTS "Only admins can create products" ON products;
DROP POLICY IF EXISTS "Only admins can update products" ON products;
DROP POLICY IF EXISTS "Only admins can delete products" ON products;

-- Create clean, non-conflicting policies for products
CREATE POLICY "authenticated_users_view_products" ON products
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "admins_insert_products" ON products
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "admins_update_products" ON products
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "admins_delete_products" ON products
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

-- 2. Clean up duplicate and conflicting policies on product_categories table
DROP POLICY IF EXISTS "Anyone can view active categories" ON product_categories;
DROP POLICY IF EXISTS "Authenticated users can view active categories" ON product_categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON product_categories;
DROP POLICY IF EXISTS "Admins can manage all categories" ON product_categories;

-- Create clean policies for product_categories
CREATE POLICY "authenticated_users_view_active_categories" ON product_categories
  FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "admins_manage_categories" ON product_categories
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

-- 3. Clean up duplicate and conflicting policies on store_products table
DROP POLICY IF EXISTS "Employees can view store products" ON store_products;
DROP POLICY IF EXISTS "Managers can manage store products" ON store_products;
DROP POLICY IF EXISTS "Store managers can manage their store products" ON store_products;
DROP POLICY IF EXISTS "Store members can view their store products" ON store_products;
DROP POLICY IF EXISTS "store_products_manage_store_staff" ON store_products;
DROP POLICY IF EXISTS "store_products_read_all" ON store_products;

-- Create clean policies for store_products
CREATE POLICY "authenticated_users_view_store_products" ON store_products
  FOR SELECT TO authenticated
  USING (
    -- Admins can see all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
    OR
    -- Employees can see their store's products
    EXISTS (
      SELECT 1 FROM employees e
      JOIN profiles p ON p.id = e.user_id
      WHERE p.id = auth.uid() AND e.store_id = store_products.store_id
    )
  );

CREATE POLICY "managers_and_admins_manage_store_products" ON store_products
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN employees e ON e.user_id = p.id
      WHERE p.id = auth.uid() 
      AND (
        p.role IN ('super_admin', 'admin')
        OR (p.role = 'manager' AND e.store_id = store_products.store_id)
      )
    )
  )
  WITH CHECK (
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

-- 4. Grant necessary permissions to authenticated role
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT INSERT, UPDATE, DELETE ON products TO authenticated;
GRANT INSERT, UPDATE, DELETE ON product_categories TO authenticated;
GRANT INSERT, UPDATE, DELETE ON store_products TO authenticated;

-- 5. Ensure RLS is enabled on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_products ENABLE ROW LEVEL SECURITY;

-- 6. Add helpful comments
COMMENT ON POLICY "authenticated_users_view_products" ON products IS 'All authenticated users can view products';
COMMENT ON POLICY "admins_insert_products" ON products IS 'Only admins can create new products';
COMMENT ON POLICY "authenticated_users_view_active_categories" ON product_categories IS 'All authenticated users can view active categories';
COMMENT ON POLICY "authenticated_users_view_store_products" ON store_products IS 'Users can view products for their store or all products if admin';

-- 7. Verify the fix by checking policy count
DO $$
DECLARE
  products_policy_count INTEGER;
  categories_policy_count INTEGER;
  store_products_policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO products_policy_count 
  FROM pg_policies WHERE tablename = 'products';
  
  SELECT COUNT(*) INTO categories_policy_count 
  FROM pg_policies WHERE tablename = 'product_categories';
  
  SELECT COUNT(*) INTO store_products_policy_count 
  FROM pg_policies WHERE tablename = 'store_products';
  
  RAISE NOTICE 'Policy counts after cleanup:';
  RAISE NOTICE 'products: % policies', products_policy_count;
  RAISE NOTICE 'product_categories: % policies', categories_policy_count;
  RAISE NOTICE 'store_products: % policies', store_products_policy_count;
END $$;