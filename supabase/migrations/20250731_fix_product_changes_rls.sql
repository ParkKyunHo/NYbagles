-- Fix RLS policies for product_changes to allow joins

-- Drop existing select policy if exists
DROP POLICY IF EXISTS "product_changes_select" ON product_changes;

-- Create new select policy that allows authenticated users to read with joins
CREATE POLICY "product_changes_select" ON product_changes
  FOR SELECT USING (
    auth.role() = 'authenticated'
  );

-- Ensure products_v3 has proper select policy for joins
DROP POLICY IF EXISTS "products_v3_select" ON products_v3;

CREATE POLICY "products_v3_select" ON products_v3
  FOR SELECT USING (
    auth.role() = 'authenticated'
  );

-- Add policy for auth.users to be readable for joins (email and profiles info)
-- Note: This is safe as we're only exposing email which is already semi-public
CREATE OR REPLACE FUNCTION public.get_user_email(user_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT email FROM auth.users WHERE id = user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_email(UUID) TO authenticated;

-- Add anon access to stores table for product changes page
DROP POLICY IF EXISTS "stores_select" ON stores;

CREATE POLICY "stores_select" ON stores
  FOR SELECT USING (
    auth.role() IN ('anon', 'authenticated')
  );