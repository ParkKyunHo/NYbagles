-- Create RPC function to get store products with proper joins
CREATE OR REPLACE FUNCTION get_store_products(p_store_id UUID)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  category_name TEXT,
  sku TEXT,
  unit TEXT,
  default_price NUMERIC,
  store_price NUMERIC,
  is_available BOOLEAN,
  stock_quantity INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS product_id,
    p.name AS product_name,
    pc.name AS category_name,
    p.sku,
    p.unit,
    p.price AS default_price,
    COALESCE(sp.custom_price, p.price) AS store_price,
    COALESCE(sp.is_available, true) AS is_available,
    COALESCE(sp.stock_quantity, 100) AS stock_quantity
  FROM products p
  LEFT JOIN product_categories pc ON p.category_id = pc.id
  LEFT JOIN store_products sp ON p.id = sp.product_id AND sp.store_id = p_store_id
  WHERE p.is_active = true
  ORDER BY pc.display_order, p.display_order, p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_store_products(UUID) TO authenticated;