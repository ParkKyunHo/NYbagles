-- 일별 매출 집계 함수
CREATE OR REPLACE FUNCTION get_daily_sales(
  p_start_date DATE,
  p_end_date DATE,
  p_store_id UUID DEFAULT NULL
)
RETURNS TABLE (
  date DATE,
  total NUMERIC,
  count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(st.created_at) as date,
    SUM(st.total_amount) as total,
    COUNT(*)::INTEGER as count
  FROM sales_transactions st
  WHERE 
    st.status = 'completed'
    AND DATE(st.created_at) BETWEEN p_start_date AND p_end_date
    AND (p_store_id IS NULL OR st.store_id = p_store_id)
  GROUP BY DATE(st.created_at)
  ORDER BY date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 재고 증가 함수 (판매 취소 시 사용)
CREATE OR REPLACE FUNCTION increment_stock(
  p_product_id UUID,
  p_quantity INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET stock_quantity = stock_quantity + p_quantity
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 일일 마감 생성 함수
CREATE OR REPLACE FUNCTION create_daily_closing(
  p_store_id UUID,
  p_closing_date DATE,
  p_created_by UUID
)
RETURNS JSON AS $$
DECLARE
  v_total_sales NUMERIC;
  v_transaction_count INTEGER;
  v_cash_amount NUMERIC;
  v_card_amount NUMERIC;
  v_mobile_amount NUMERIC;
  v_result JSON;
BEGIN
  -- 매출 집계
  SELECT 
    COALESCE(SUM(total_amount), 0),
    COUNT(*),
    COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_method = 'mobile' THEN total_amount ELSE 0 END), 0)
  INTO 
    v_total_sales,
    v_transaction_count,
    v_cash_amount,
    v_card_amount,
    v_mobile_amount
  FROM sales_transactions
  WHERE 
    store_id = p_store_id
    AND DATE(created_at) = p_closing_date
    AND status = 'completed';
  
  -- 결과 JSON 생성
  v_result := json_build_object(
    'date', p_closing_date,
    'total_sales', v_total_sales,
    'transaction_count', v_transaction_count,
    'cash_amount', v_cash_amount,
    'card_amount', v_card_amount,
    'mobile_amount', v_mobile_amount,
    'created_by', p_created_by,
    'created_at', NOW()
  );
  
  -- 마감 기록 저장 (daily_closings 테이블이 있다면)
  -- INSERT INTO daily_closings (...) VALUES (...);
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 상품별 매출 순위 함수
CREATE OR REPLACE FUNCTION get_product_sales_ranking(
  p_start_date DATE,
  p_end_date DATE,
  p_store_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  total_quantity BIGINT,
  total_revenue NUMERIC,
  ranking INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH product_sales AS (
    SELECT 
      si.product_id,
      p.name as product_name,
      SUM(si.quantity) as total_quantity,
      SUM(si.subtotal) as total_revenue
    FROM sales_items si
    INNER JOIN sales_transactions st ON si.transaction_id = st.id
    INNER JOIN products p ON si.product_id = p.id
    WHERE 
      st.status = 'completed'
      AND DATE(st.created_at) BETWEEN p_start_date AND p_end_date
      AND (p_store_id IS NULL OR st.store_id = p_store_id)
    GROUP BY si.product_id, p.name
  )
  SELECT 
    ps.product_id,
    ps.product_name,
    ps.total_quantity,
    ps.total_revenue,
    ROW_NUMBER() OVER (ORDER BY ps.total_revenue DESC)::INTEGER as ranking
  FROM product_sales ps
  ORDER BY ps.total_revenue DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 시간대별 매출 분석 함수
CREATE OR REPLACE FUNCTION get_hourly_sales(
  p_date DATE,
  p_store_id UUID DEFAULT NULL
)
RETURNS TABLE (
  hour INTEGER,
  total_sales NUMERIC,
  transaction_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    EXTRACT(HOUR FROM st.created_at)::INTEGER as hour,
    SUM(st.total_amount) as total_sales,
    COUNT(*)::INTEGER as transaction_count
  FROM sales_transactions st
  WHERE 
    st.status = 'completed'
    AND DATE(st.created_at) = p_date
    AND (p_store_id IS NULL OR st.store_id = p_store_id)
  GROUP BY EXTRACT(HOUR FROM st.created_at)
  ORDER BY hour;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_sales_transactions_created_at_status 
ON sales_transactions(created_at, status) 
WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_sales_transactions_store_id_created_at 
ON sales_transactions(store_id, created_at) 
WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_sales_items_transaction_id 
ON sales_items(transaction_id);

CREATE INDEX IF NOT EXISTS idx_sales_items_product_id 
ON sales_items(product_id);

-- 권한 부여
GRANT EXECUTE ON FUNCTION get_daily_sales TO authenticated;
GRANT EXECUTE ON FUNCTION increment_stock TO authenticated;
GRANT EXECUTE ON FUNCTION create_daily_closing TO authenticated;
GRANT EXECUTE ON FUNCTION get_product_sales_ranking TO authenticated;
GRANT EXECUTE ON FUNCTION get_hourly_sales TO authenticated;