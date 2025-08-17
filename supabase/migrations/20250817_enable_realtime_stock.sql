-- Enable real-time for stock management tables
-- This allows the UI to update automatically when stock changes

-- Enable real-time for products table
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS products;

-- Enable real-time for inventory movements
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS inventory_movements;

-- Enable real-time for sales transactions
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS sales_transactions;

-- Enable real-time for sales items
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS sales_items;

-- Enable real-time for product changes (for approval workflow)
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS product_changes;

-- Add composite index for better real-time query performance
CREATE INDEX IF NOT EXISTS idx_products_store_stock ON products(store_id, stock_quantity);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_recent ON inventory_movements(product_id, performed_at DESC);

-- Create a function to broadcast stock changes
CREATE OR REPLACE FUNCTION broadcast_stock_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify about stock changes
  PERFORM pg_notify(
    'stock_change',
    json_build_object(
      'product_id', NEW.id,
      'store_id', NEW.store_id,
      'old_stock', OLD.stock_quantity,
      'new_stock', NEW.stock_quantity,
      'product_name', NEW.name
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for stock change notifications
DROP TRIGGER IF EXISTS trigger_broadcast_stock_change ON products;
CREATE TRIGGER trigger_broadcast_stock_change
  AFTER UPDATE OF stock_quantity ON products
  FOR EACH ROW
  EXECUTE FUNCTION broadcast_stock_change();

-- Add a view for real-time stock monitoring
CREATE OR REPLACE VIEW realtime_stock_status AS
SELECT 
  p.id,
  p.name,
  p.store_id,
  s.name as store_name,
  p.stock_quantity,
  p.min_stock_level,
  CASE 
    WHEN p.stock_quantity = 0 THEN 'out_of_stock'
    WHEN p.stock_quantity <= p.min_stock_level THEN 'low_stock'
    ELSE 'in_stock'
  END as stock_status,
  p.updated_at
FROM products p
JOIN stores s ON p.store_id = s.id
WHERE p.status = 'active';

-- Grant permissions for the view
GRANT SELECT ON realtime_stock_status TO authenticated;

COMMENT ON VIEW realtime_stock_status IS 'Real-time view of product stock status across stores';