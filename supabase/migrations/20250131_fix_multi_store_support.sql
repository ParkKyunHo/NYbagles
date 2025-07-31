-- Fix multi-store support and add store_id to profiles table

-- 1. Add store_id to profiles table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'profiles' 
                 AND column_name = 'store_id') THEN
    ALTER TABLE profiles ADD COLUMN store_id UUID REFERENCES stores(id);
  END IF;
END $$;

-- 2. Create index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_store_id ON profiles(store_id);

-- 3. Update RLS policies for products to consider store context
DROP POLICY IF EXISTS "Authenticated users can view active products" ON products;
DROP POLICY IF EXISTS "Managers and admins can view all products" ON products;

-- All authenticated users can view products (central catalog)
CREATE POLICY "All authenticated users can view products"
ON products FOR SELECT
TO authenticated
USING (true);

-- 4. Update store_products RLS policies for better store-based access
DROP POLICY IF EXISTS "Store members can view their store products" ON store_products;
DROP POLICY IF EXISTS "Managers can manage their store products" ON store_products;
DROP POLICY IF EXISTS "Super admins can manage all store products" ON store_products;

-- Store members can view their store's products
CREATE POLICY "Store members can view their store products"
ON store_products FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.store_id = store_products.store_id
  )
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin')
  )
);

-- Store managers can manage their store's products
CREATE POLICY "Store managers can manage their store products"
ON store_products FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.store_id = store_products.store_id
    AND profiles.role IN ('manager')
  )
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin')
  )
);

-- 5. Create a function to get user's store
CREATE OR REPLACE FUNCTION get_user_store_id()
RETURNS UUID AS $$
DECLARE
  store_id UUID;
BEGIN
  SELECT profiles.store_id INTO store_id
  FROM profiles
  WHERE profiles.id = auth.uid();
  
  RETURN store_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Fix the employee signup approval process
-- Update the handle_new_user function to include store_id
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role, store_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'employee'),
    (NEW.raw_user_meta_data->>'store_id')::UUID
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Add system settings table for admin controls
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Only super admins can manage system settings
CREATE POLICY "Super admins can manage system settings"
ON system_settings FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'super_admin'
  )
);

-- Insert default system settings
INSERT INTO system_settings (key, value, description) VALUES
  ('multi_store_enabled', 'true'::jsonb, '다중 매장 기능 활성화'),
  ('store_selection_required', 'true'::jsonb, '상품/판매 관리 시 매장 선택 필수'),
  ('manager_store_restriction', 'true'::jsonb, '매니저는 자신의 매장만 관리 가능')
ON CONFLICT (key) DO NOTHING;