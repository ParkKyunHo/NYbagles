-- Create or replace the function to handle sales cancellation with automatic stock restoration
CREATE OR REPLACE FUNCTION cancel_sales_transaction(
  p_sale_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale RECORD;
  v_item RECORD;
  v_current_stock INTEGER;
BEGIN
  -- Get the sale record
  SELECT * INTO v_sale
  FROM sales_transactions
  WHERE id = p_sale_id
  FOR UPDATE;

  -- Check if sale exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;

  -- Check if sale is already cancelled
  IF v_sale.status = 'cancelled' THEN
    RAISE EXCEPTION 'Sale is already cancelled';
  END IF;

  -- Check if user has permission to cancel (only the seller or manager/admin can cancel)
  IF v_sale.sold_by != auth.uid() THEN
    -- Check if user is manager or admin
    IF NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('manager', 'admin', 'super_admin')
    ) THEN
      RAISE EXCEPTION 'You do not have permission to cancel this sale';
    END IF;
  END IF;

  -- Process each item to restore stock
  FOR v_item IN 
    SELECT * FROM sales_items
    WHERE sale_id = p_sale_id
  LOOP
    -- Get current stock
    SELECT stock_quantity INTO v_current_stock
    FROM products
    WHERE id = v_item.product_id
    FOR UPDATE;

    -- Restore stock
    IF v_current_stock IS NOT NULL THEN
      UPDATE products
      SET 
        stock_quantity = stock_quantity + v_item.quantity,
        updated_at = NOW()
      WHERE id = v_item.product_id;

      -- Log the stock change
      INSERT INTO product_changes (
        product_id,
        change_type,
        old_values,
        new_values,
        change_reason,
        requested_by,
        approved_by,
        approved_at,
        status
      ) VALUES (
        v_item.product_id,
        'stock_update',
        jsonb_build_object('stock_quantity', v_current_stock),
        jsonb_build_object('stock_quantity', v_current_stock + v_item.quantity),
        'Sale cancellation #' || p_sale_id || COALESCE(': ' || p_reason, ''),
        auth.uid(),
        auth.uid(),
        NOW(),
        'approved'
      );
    END IF;
  END LOOP;

  -- Update the sale status to cancelled
  UPDATE sales_transactions
  SET 
    status = 'cancelled',
    cancelled_at = NOW(),
    cancelled_by = auth.uid(),
    cancel_reason = p_reason,
    updated_at = NOW()
  WHERE id = p_sale_id;

  RETURN TRUE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION cancel_sales_transaction(UUID, TEXT) TO authenticated;

-- Add necessary columns to sales_transactions if they don't exist
DO $$
BEGIN
  -- Add cancelled_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_transactions' AND column_name = 'cancelled_at'
  ) THEN
    ALTER TABLE sales_transactions ADD COLUMN cancelled_at TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Add cancelled_by column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_transactions' AND column_name = 'cancelled_by'
  ) THEN
    ALTER TABLE sales_transactions ADD COLUMN cancelled_by UUID REFERENCES profiles(id);
  END IF;

  -- Add cancel_reason column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_transactions' AND column_name = 'cancel_reason'
  ) THEN
    ALTER TABLE sales_transactions ADD COLUMN cancel_reason TEXT;
  END IF;
END $$;