-- Create or replace the function to handle sales transactions with automatic stock updates
CREATE OR REPLACE FUNCTION create_sales_transaction(
  p_store_id UUID,
  p_items JSONB,
  p_payment_method TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale_id UUID;
  v_total_amount DECIMAL(10,2) := 0;
  v_item JSONB;
  v_product_id UUID;
  v_quantity INTEGER;
  v_unit_price DECIMAL(10,2);
  v_subtotal DECIMAL(10,2);
  v_discount_amount DECIMAL(10,2);
  v_current_stock INTEGER;
BEGIN
  -- Create the sales transaction record
  INSERT INTO sales_transactions (
    store_id,
    sold_by,
    payment_method,
    notes,
    status
  ) VALUES (
    p_store_id,
    auth.uid(),
    p_payment_method,
    p_notes,
    'completed'
  ) RETURNING id INTO v_sale_id;

  -- Process each item in the sale
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_unit_price := (v_item->>'unit_price')::DECIMAL;
    v_subtotal := (v_item->>'subtotal')::DECIMAL;
    v_discount_amount := COALESCE((v_item->>'discount_amount')::DECIMAL, 0);

    -- Check current stock
    SELECT stock_quantity INTO v_current_stock
    FROM products
    WHERE id = v_product_id
    FOR UPDATE; -- Lock the row to prevent concurrent updates

    -- Verify sufficient stock
    IF v_current_stock IS NOT NULL AND v_current_stock < v_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product %', v_product_id;
    END IF;

    -- Insert sales item
    INSERT INTO sales_items (
      sale_id,
      product_id,
      quantity,
      unit_price,
      subtotal,
      discount_amount
    ) VALUES (
      v_sale_id,
      v_product_id,
      v_quantity,
      v_unit_price,
      v_subtotal,
      v_discount_amount
    );

    -- Update product stock (decrease by quantity sold)
    IF v_current_stock IS NOT NULL THEN
      UPDATE products
      SET 
        stock_quantity = stock_quantity - v_quantity,
        updated_at = NOW()
      WHERE id = v_product_id;

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
        v_product_id,
        'stock_update',
        jsonb_build_object('stock_quantity', v_current_stock),
        jsonb_build_object('stock_quantity', v_current_stock - v_quantity),
        'Sale transaction #' || v_sale_id,
        auth.uid(),
        auth.uid(),
        NOW(),
        'approved'
      );
    END IF;

    -- Calculate total amount
    v_total_amount := v_total_amount + v_subtotal - v_discount_amount;
  END LOOP;

  -- Update the total amount for the sale
  UPDATE sales_transactions
  SET total_amount = v_total_amount
  WHERE id = v_sale_id;

  RETURN v_sale_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_sales_transaction(UUID, JSONB, TEXT, TEXT) TO authenticated;