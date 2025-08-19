-- QR System Performance and Security Optimization
-- Migration: 20250119_optimize_qr_system.sql

-- 1. Add composite indexes for faster QR token lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_qr_tokens_lookup 
ON qr_tokens(token_hash, store_id, is_used, valid_until)
WHERE is_used = false;

-- 2. Add partial index for active tokens only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_qr_tokens_active 
ON qr_tokens(store_id, valid_until)
WHERE is_used = false AND valid_until > NOW();

-- 3. Create rate limiting table for QR scans
CREATE TABLE IF NOT EXISTS qr_scan_rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identifier TEXT NOT NULL, -- Can be IP, user_id, or device_id
  identifier_type TEXT NOT NULL CHECK (identifier_type IN ('ip', 'user', 'device')),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  scan_count INT DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  window_end TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 minute',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(identifier, identifier_type, store_id, window_start)
);

-- 4. Create QR scan logs for audit and debugging
CREATE TABLE IF NOT EXISTS qr_scan_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  token_hash TEXT,
  scan_result TEXT CHECK (scan_result IN ('success', 'invalid_token', 'expired', 'rate_limited', 'permission_denied', 'error')),
  error_message TEXT,
  ip_address INET,
  user_agent TEXT,
  device_info JSONB,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  location_accuracy INT,
  response_time_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Add store location validation table
CREATE TABLE IF NOT EXISTS store_geofences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  center_lat DECIMAL(10, 8) NOT NULL,
  center_lng DECIMAL(11, 8) NOT NULL,
  radius_meters INT DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id)
);

-- 6. Create materialized view for QR scan analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS qr_scan_analytics AS
SELECT 
  s.id as store_id,
  s.name as store_name,
  DATE_TRUNC('hour', qsl.created_at) as hour,
  COUNT(*) as total_scans,
  COUNT(CASE WHEN qsl.scan_result = 'success' THEN 1 END) as successful_scans,
  COUNT(CASE WHEN qsl.scan_result = 'invalid_token' THEN 1 END) as invalid_tokens,
  COUNT(CASE WHEN qsl.scan_result = 'expired' THEN 1 END) as expired_tokens,
  COUNT(CASE WHEN qsl.scan_result = 'rate_limited' THEN 1 END) as rate_limited,
  AVG(qsl.response_time_ms) as avg_response_time_ms,
  COUNT(DISTINCT qsl.employee_id) as unique_employees
FROM stores s
LEFT JOIN qr_scan_logs qsl ON s.id = qsl.store_id
WHERE qsl.created_at >= NOW() - INTERVAL '7 days'
GROUP BY s.id, s.name, DATE_TRUNC('hour', qsl.created_at);

-- 7. Create index on the materialized view
CREATE UNIQUE INDEX ON qr_scan_analytics (store_id, hour);

-- 8. Optimize attendance_records for QR queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_qr 
ON attendance_records(employee_id, work_date, check_in_method)
WHERE check_in_method = 'qr';

-- 9. Add connection pool monitoring table
CREATE TABLE IF NOT EXISTS connection_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_type TEXT NOT NULL CHECK (metric_type IN ('pool_size', 'active_connections', 'idle_connections', 'wait_queue')),
  value INT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Create optimized function for QR token validation with rate limiting
CREATE OR REPLACE FUNCTION validate_qr_token_with_rate_limit(
  p_token_hash TEXT,
  p_store_id UUID,
  p_identifier TEXT,
  p_identifier_type TEXT DEFAULT 'user'
) RETURNS TABLE(
  is_valid BOOLEAN,
  rate_limited BOOLEAN,
  token_id UUID,
  message TEXT
) AS $$
DECLARE
  v_token_valid BOOLEAN := false;
  v_rate_limited BOOLEAN := false;
  v_token_id UUID;
  v_scan_count INT;
  v_max_scans INT := 10; -- Max scans per minute
BEGIN
  -- Check rate limiting
  SELECT COUNT(*) INTO v_scan_count
  FROM qr_scan_rate_limits
  WHERE identifier = p_identifier
    AND identifier_type = p_identifier_type
    AND store_id = p_store_id
    AND window_end > NOW();
  
  IF v_scan_count >= v_max_scans THEN
    v_rate_limited := true;
    RETURN QUERY SELECT false, true, NULL::UUID, 'Rate limit exceeded. Please wait before scanning again.'::TEXT;
    RETURN;
  END IF;
  
  -- Validate token
  SELECT qt.id, true INTO v_token_id, v_token_valid
  FROM qr_tokens qt
  WHERE qt.token_hash = p_token_hash
    AND qt.store_id = p_store_id
    AND qt.is_used = false
    AND qt.valid_until > NOW()
  FOR UPDATE SKIP LOCKED -- Prevent concurrent token usage
  LIMIT 1;
  
  IF NOT v_token_valid THEN
    RETURN QUERY SELECT false, false, NULL::UUID, 'Invalid or expired QR code'::TEXT;
    RETURN;
  END IF;
  
  -- Update rate limit
  INSERT INTO qr_scan_rate_limits (identifier, identifier_type, store_id)
  VALUES (p_identifier, p_identifier_type, p_store_id)
  ON CONFLICT (identifier, identifier_type, store_id, window_start) 
  DO UPDATE SET scan_count = qr_scan_rate_limits.scan_count + 1;
  
  RETURN QUERY SELECT true, false, v_token_id, 'Token valid'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Create function for geofence validation
CREATE OR REPLACE FUNCTION validate_location_in_geofence(
  p_store_id UUID,
  p_lat DECIMAL(10, 8),
  p_lng DECIMAL(11, 8)
) RETURNS BOOLEAN AS $$
DECLARE
  v_distance_meters FLOAT;
  v_max_radius INT;
BEGIN
  -- Calculate distance using Haversine formula
  SELECT 
    6371000 * acos(
      cos(radians(sg.center_lat)) * cos(radians(p_lat)) * 
      cos(radians(p_lng) - radians(sg.center_lng)) + 
      sin(radians(sg.center_lat)) * sin(radians(p_lat))
    ),
    sg.radius_meters
  INTO v_distance_meters, v_max_radius
  FROM store_geofences sg
  WHERE sg.store_id = p_store_id
    AND sg.is_active = true;
  
  IF v_distance_meters IS NULL THEN
    -- No geofence configured, allow
    RETURN true;
  END IF;
  
  RETURN v_distance_meters <= v_max_radius;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Create optimized check-in function
CREATE OR REPLACE FUNCTION process_qr_checkin(
  p_employee_id UUID,
  p_store_id UUID,
  p_token_hash TEXT,
  p_lat DECIMAL(10, 8) DEFAULT NULL,
  p_lng DECIMAL(11, 8) DEFAULT NULL,
  p_accuracy INT DEFAULT NULL
) RETURNS TABLE(
  success BOOLEAN,
  action_type TEXT,
  record_id UUID,
  message TEXT
) AS $$
DECLARE
  v_existing_record RECORD;
  v_new_record_id UUID;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Check for existing check-in today
  SELECT * INTO v_existing_record
  FROM attendance_records
  WHERE employee_id = p_employee_id
    AND work_date = v_today
    AND check_out_time IS NULL
  FOR UPDATE SKIP LOCKED;
  
  IF v_existing_record.id IS NOT NULL THEN
    -- Process check-out
    UPDATE attendance_records
    SET 
      check_out_time = NOW(),
      total_hours = EXTRACT(EPOCH FROM (NOW() - check_in_time)) / 3600.0
    WHERE id = v_existing_record.id
    RETURNING id INTO v_new_record_id;
    
    RETURN QUERY SELECT true, 'checkout'::TEXT, v_new_record_id, 'Successfully checked out'::TEXT;
  ELSE
    -- Process check-in
    INSERT INTO attendance_records (
      employee_id,
      store_id,
      check_in_time,
      work_date,
      status,
      check_in_method,
      qr_validation_token,
      location_lat,
      location_lng,
      location_accuracy
    ) VALUES (
      p_employee_id,
      p_store_id,
      NOW(),
      v_today,
      'present',
      'qr',
      p_token_hash,
      p_lat,
      p_lng,
      p_accuracy
    )
    RETURNING id INTO v_new_record_id;
    
    RETURN QUERY SELECT true, 'checkin'::TEXT, v_new_record_id, 'Successfully checked in'::TEXT;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT false, 'error'::TEXT, NULL::UUID, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Create background job for cleaning expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_qr_tokens()
RETURNS void AS $$
BEGIN
  -- Delete tokens older than 1 hour
  DELETE FROM qr_tokens
  WHERE valid_until < NOW() - INTERVAL '1 hour'
    AND is_used = false;
  
  -- Clean up old rate limit records
  DELETE FROM qr_scan_rate_limits
  WHERE window_end < NOW() - INTERVAL '1 hour';
  
  -- Clean up old scan logs (keep 30 days)
  DELETE FROM qr_scan_logs
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  -- Refresh materialized view
  REFRESH MATERIALIZED VIEW CONCURRENTLY qr_scan_analytics;
END;
$$ LANGUAGE plpgsql;

-- 14. Add RLS policies for new tables
ALTER TABLE qr_scan_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_scan_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_geofences ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_metrics ENABLE ROW LEVEL SECURITY;

-- Rate limits: Only system can manage
CREATE POLICY "System manages rate limits" ON qr_scan_rate_limits
  FOR ALL USING (false);

-- Scan logs: Admins and managers can view
CREATE POLICY "Admins view scan logs" ON qr_scan_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin', 'manager')
    )
  );

-- Geofences: Admins can manage
CREATE POLICY "Admins manage geofences" ON store_geofences
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- Connection metrics: Super admins only
CREATE POLICY "Super admins view metrics" ON connection_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- 15. Create triggers for updated_at
CREATE TRIGGER update_store_geofences_updated_at 
  BEFORE UPDATE ON store_geofences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 16. Add monitoring indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scan_logs_created 
ON qr_scan_logs(created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scan_logs_store_result 
ON qr_scan_logs(store_id, scan_result, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rate_limits_cleanup 
ON qr_scan_rate_limits(window_end)
WHERE window_end < NOW();

-- 17. Create function to get QR scan statistics
CREATE OR REPLACE FUNCTION get_qr_scan_stats(
  p_store_id UUID,
  p_period INTERVAL DEFAULT INTERVAL '24 hours'
) RETURNS TABLE(
  total_scans BIGINT,
  successful_scans BIGINT,
  failed_scans BIGINT,
  unique_employees BIGINT,
  avg_response_time_ms NUMERIC,
  success_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_scans,
    COUNT(CASE WHEN scan_result = 'success' THEN 1 END)::BIGINT as successful_scans,
    COUNT(CASE WHEN scan_result != 'success' THEN 1 END)::BIGINT as failed_scans,
    COUNT(DISTINCT employee_id)::BIGINT as unique_employees,
    ROUND(AVG(response_time_ms)::NUMERIC, 2) as avg_response_time_ms,
    ROUND((COUNT(CASE WHEN scan_result = 'success' THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0) * 100), 2) as success_rate
  FROM qr_scan_logs
  WHERE store_id = p_store_id
    AND created_at >= NOW() - p_period;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 18. Grant necessary permissions
GRANT SELECT ON qr_scan_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION validate_qr_token_with_rate_limit TO authenticated;
GRANT EXECUTE ON FUNCTION validate_location_in_geofence TO authenticated;
GRANT EXECUTE ON FUNCTION process_qr_checkin TO authenticated;
GRANT EXECUTE ON FUNCTION get_qr_scan_stats TO authenticated;

-- 19. Schedule cleanup job (Note: This needs to be set up in Supabase dashboard or via pg_cron)
-- SELECT cron.schedule('cleanup-expired-qr-tokens', '*/15 * * * *', 'SELECT cleanup_expired_qr_tokens();');

-- 20. Add comments for documentation
COMMENT ON TABLE qr_scan_rate_limits IS 'Rate limiting for QR code scans to prevent abuse';
COMMENT ON TABLE qr_scan_logs IS 'Audit log of all QR scan attempts for debugging and analytics';
COMMENT ON TABLE store_geofences IS 'Geographic boundaries for store location validation';
COMMENT ON TABLE connection_metrics IS 'Database connection pool monitoring metrics';
COMMENT ON FUNCTION validate_qr_token_with_rate_limit IS 'Validates QR tokens with built-in rate limiting';
COMMENT ON FUNCTION process_qr_checkin IS 'Optimized function for processing employee check-ins via QR code';