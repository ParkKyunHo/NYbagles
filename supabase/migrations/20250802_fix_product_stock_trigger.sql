-- Fix product stock update trigger for products_v3

-- Create function to update product stock after sale
CREATE OR REPLACE FUNCTION update_product_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- For sales (positive quantity)
  IF NEW.quantity > 0 THEN
    UPDATE products_v3
    SET 
      stock_quantity = stock_quantity - NEW.quantity,
      updated_at = NOW()
    WHERE id = NEW.product_id;
  -- For returns (negative quantity)
  ELSE
    UPDATE products_v3
    SET 
      stock_quantity = stock_quantity - NEW.quantity, -- Double negative becomes positive
      updated_at = NOW()
    WHERE id = NEW.product_id;
  END IF;
  
  -- Also create inventory movement record
  INSERT INTO inventory_movements (
    product_id,
    store_id,
    movement_type,
    quantity,
    reference_type,
    reference_id,
    stock_before,
    stock_after,
    performed_by,
    performed_at
  )
  SELECT
    NEW.product_id,
    st.store_id,
    CASE WHEN NEW.quantity > 0 THEN 'sale' ELSE 'return' END,
    NEW.quantity,
    'sales_transaction',
    NEW.transaction_id,
    NEW.stock_before,
    NEW.stock_after,
    st.sold_by,
    NOW()
  FROM sales_transactions st
  WHERE st.id = NEW.transaction_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on sales_items table
DROP TRIGGER IF EXISTS update_product_stock_on_sale ON sales_items;
CREATE TRIGGER update_product_stock_on_sale
  AFTER INSERT ON sales_items
  FOR EACH ROW
  EXECUTE FUNCTION update_product_stock();

-- Also create a function to validate stock before sale
CREATE OR REPLACE FUNCTION validate_stock_before_sale()
RETURNS TRIGGER AS $$
DECLARE
  current_stock INTEGER;
BEGIN
  -- Only validate for sales (positive quantity)
  IF NEW.quantity > 0 THEN
    SELECT stock_quantity INTO current_stock
    FROM products_v3
    WHERE id = NEW.product_id;
    
    IF current_stock < NEW.quantity THEN
      RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', current_stock, NEW.quantity;
    END IF;
    
    -- Set stock snapshot values
    NEW.stock_before := current_stock;
    NEW.stock_after := current_stock - NEW.quantity;
  ELSE
    -- For returns, just set the stock values
    SELECT stock_quantity INTO current_stock
    FROM products_v3
    WHERE id = NEW.product_id;
    
    NEW.stock_before := current_stock;
    NEW.stock_after := current_stock - NEW.quantity; -- Double negative becomes positive
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate stock before inserting sales_items
DROP TRIGGER IF EXISTS validate_stock_before_sale_trigger ON sales_items;
CREATE TRIGGER validate_stock_before_sale_trigger
  BEFORE INSERT ON sales_items
  FOR EACH ROW
  EXECUTE FUNCTION validate_stock_before_sale();