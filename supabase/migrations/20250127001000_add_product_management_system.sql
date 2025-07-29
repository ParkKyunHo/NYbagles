-- Add Product Management System for Multi-Store
-- Migration: 20250127001000_add_product_management_system.sql

-- 1. Create product_categories table
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Update products table to add new fields
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES product_categories(id),
  ADD COLUMN IF NOT EXISTS sku TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT '개',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Create store_products table for store-specific product settings
CREATE TABLE IF NOT EXISTS store_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  custom_price DECIMAL(10,2), -- NULL means use default price from products table
  is_available BOOLEAN DEFAULT true,
  stock_quantity INTEGER DEFAULT 0,
  min_stock_alert INTEGER DEFAULT 10,
  display_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, product_id)
);

-- 4. Create price_history table for audit trail
CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_product_id UUID REFERENCES store_products(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  old_price DECIMAL(10,2),
  new_price DECIMAL(10,2) NOT NULL,
  changed_by UUID REFERENCES profiles(id),
  change_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_store_products_store ON store_products(store_id);
CREATE INDEX IF NOT EXISTS idx_store_products_product ON store_products(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_store_product ON price_history(store_product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_created ON price_history(created_at);

-- 6. Enable RLS on new tables
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for product_categories
-- Everyone can view active categories
CREATE POLICY "Anyone can view active categories" ON product_categories
  FOR SELECT USING (is_active = true);

-- Only super_admin and admin can manage categories
CREATE POLICY "Admins can manage categories" ON product_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

-- 8. Update RLS Policies for products table
DROP POLICY IF EXISTS "Anyone can view active products" ON products;
DROP POLICY IF EXISTS "Admins can manage products" ON products;

-- Everyone can view products
CREATE POLICY "Anyone can view products" ON products
  FOR SELECT USING (true);

-- Only super_admin and admin can manage products
CREATE POLICY "Admins can manage products" ON products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

-- 9. RLS Policies for store_products
-- Employees can view their store's products
CREATE POLICY "Employees can view store products" ON store_products
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM employees e
      JOIN profiles p ON p.id = e.user_id
      WHERE p.id = auth.uid()
      AND e.store_id = store_products.store_id
    )
  );

-- Managers can manage their store's products
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

-- 10. RLS Policies for price_history
-- View own store's price history
CREATE POLICY "View store price history" ON price_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN employees e ON e.user_id = p.id
      WHERE p.id = auth.uid() 
      AND (
        p.role IN ('super_admin', 'admin')
        OR (p.role IN ('manager', 'employee') AND e.store_id = price_history.store_id)
      )
    )
  );

-- Only system can insert price history (through triggers)
CREATE POLICY "System inserts price history" ON price_history
  FOR INSERT WITH CHECK (changed_by = auth.uid());

-- 11. Create triggers for updated_at
CREATE TRIGGER update_product_categories_updated_at 
  BEFORE UPDATE ON product_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at 
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_products_updated_at 
  BEFORE UPDATE ON store_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 12. Create trigger to log price changes
CREATE OR REPLACE FUNCTION log_price_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Log when custom_price changes
  IF (OLD.custom_price IS DISTINCT FROM NEW.custom_price) THEN
    INSERT INTO price_history (
      store_product_id,
      product_id,
      store_id,
      old_price,
      new_price,
      changed_by
    ) VALUES (
      NEW.id,
      NEW.product_id,
      NEW.store_id,
      OLD.custom_price,
      NEW.custom_price,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER log_store_product_price_changes
  AFTER UPDATE ON store_products
  FOR EACH ROW EXECUTE FUNCTION log_price_change();

-- 13. Create view for product availability with effective price
CREATE OR REPLACE VIEW product_catalog AS
SELECT 
  p.id as product_id,
  p.name as product_name,
  p.description,
  p.sku,
  p.unit,
  p.image_url,
  pc.name as category_name,
  p.price as default_price,
  sp.store_id,
  sp.custom_price,
  COALESCE(sp.custom_price, p.price) as effective_price,
  sp.is_available,
  sp.stock_quantity,
  sp.display_order as store_display_order,
  COALESCE(sp.display_order, p.display_order) as effective_display_order
FROM products p
LEFT JOIN product_categories pc ON pc.id = p.category_id
LEFT JOIN store_products sp ON sp.product_id = p.id
WHERE p.is_active = true
ORDER BY pc.display_order, effective_display_order, p.name;

-- 14. Grant permissions on views
GRANT SELECT ON product_catalog TO authenticated;

-- 15. Insert default product categories
INSERT INTO product_categories (name, display_order) VALUES
  ('베이글', 1),
  ('스프레드', 2),
  ('음료', 3),
  ('디저트', 4),
  ('세트메뉴', 5)
ON CONFLICT (name) DO NOTHING;

-- 16. Update existing products to use categories
UPDATE products p
SET category_id = pc.id
FROM product_categories pc
WHERE p.category = pc.name;

-- 17. Create function to initialize store products
CREATE OR REPLACE FUNCTION initialize_store_products(p_store_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Insert all active products for the store with default settings
  INSERT INTO store_products (store_id, product_id, is_available)
  SELECT p_store_id, p.id, true
  FROM products p
  WHERE p.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM store_products sp
    WHERE sp.store_id = p_store_id AND sp.product_id = p.id
  );
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 18. Create function to get store product catalog
CREATE OR REPLACE FUNCTION get_store_products(p_store_id UUID)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  category_name TEXT,
  sku TEXT,
  unit TEXT,
  default_price DECIMAL,
  store_price DECIMAL,
  is_available BOOLEAN,
  stock_quantity INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    pc.name,
    p.sku,
    p.unit,
    p.price,
    sp.custom_price,
    COALESCE(sp.is_available, false),
    COALESCE(sp.stock_quantity, 0)
  FROM products p
  LEFT JOIN product_categories pc ON pc.id = p.category_id
  LEFT JOIN store_products sp ON sp.product_id = p.id AND sp.store_id = p_store_id
  WHERE p.is_active = true
  ORDER BY pc.display_order, COALESCE(sp.display_order, p.display_order), p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;