-- Disable old product system triggers to prevent conflicts with products_v3

-- Drop triggers related to old product system
DROP TRIGGER IF EXISTS create_store_products_on_new_product ON products;
DROP TRIGGER IF EXISTS create_products_on_new_store ON stores;

-- Drop the associated functions
DROP FUNCTION IF EXISTS auto_create_store_products();
DROP FUNCTION IF EXISTS auto_create_products_for_store();

-- Also drop any trigger that might exist on products_v2
DROP TRIGGER IF EXISTS auto_update_stock_after_sale ON sales;
DROP FUNCTION IF EXISTS update_product_stock_after_sale();

-- Add comment to store_products table to indicate it's deprecated
COMMENT ON TABLE store_products IS 'DEPRECATED - Use products_v3 instead. This table is kept for historical data only.';
COMMENT ON TABLE products IS 'DEPRECATED - Use products_v3 instead. This table is kept for historical data only.';
COMMENT ON TABLE products_v2 IS 'DEPRECATED - Use products_v3 instead. This table is kept for historical data only.';

-- Remove any foreign key constraints that might cause issues
-- Note: This won't drop the constraint if it doesn't exist
ALTER TABLE store_products DROP CONSTRAINT IF EXISTS store_products_product_id_fkey;
ALTER TABLE store_products DROP CONSTRAINT IF EXISTS store_products_store_id_fkey;

-- Recreate the constraints as DEFERRABLE to prevent immediate constraint violations
ALTER TABLE store_products 
  ADD CONSTRAINT store_products_product_id_fkey 
  FOREIGN KEY (product_id) 
  REFERENCES products(id) 
  ON DELETE CASCADE 
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE store_products 
  ADD CONSTRAINT store_products_store_id_fkey 
  FOREIGN KEY (store_id) 
  REFERENCES stores(id) 
  ON DELETE CASCADE 
  DEFERRABLE INITIALLY DEFERRED;