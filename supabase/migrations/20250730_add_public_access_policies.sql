-- Add public access policies for regions and store_categories
-- This allows unauthenticated users (like those signing up) to view active regions and categories

-- 1. Add policy for public to view active regions
CREATE POLICY "Public can view active regions" ON regions
  FOR SELECT 
  USING (is_active = true);

-- 2. Add policy for public to view active store categories
CREATE POLICY "Public can view active store categories" ON store_categories
  FOR SELECT 
  USING (is_active = true);

-- 3. Also ensure that everyone can view active stores (if not already present)
-- First, check if a similar policy exists and drop it if needed
DO $$
BEGIN
  -- Drop existing policy if it exists (to avoid conflicts)
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'stores' 
    AND policyname = 'Public can view active stores'
  ) THEN
    DROP POLICY "Public can view active stores" ON stores;
  END IF;
END $$;

-- Create the public access policy for stores
CREATE POLICY "Public can view active stores" ON stores
  FOR SELECT 
  USING (is_active = true);

-- 4. Verify that the policies are working by selecting data
-- This is just for verification and won't affect the actual policies
DO $$
DECLARE
  region_count INTEGER;
  category_count INTEGER;
  store_count INTEGER;
BEGIN
  -- Count active regions
  SELECT COUNT(*) INTO region_count
  FROM regions
  WHERE is_active = true;
  
  -- Count active categories
  SELECT COUNT(*) INTO category_count
  FROM store_categories
  WHERE is_active = true;
  
  -- Count active stores
  SELECT COUNT(*) INTO store_count
  FROM stores
  WHERE is_active = true;
  
  RAISE NOTICE 'Public access policies created. Active counts - Regions: %, Categories: %, Stores: %', 
    region_count, category_count, store_count;
END $$;