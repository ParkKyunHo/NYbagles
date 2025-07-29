-- Add QR Login System and Hierarchical Store Management
-- Migration: 20240125000000_add_qr_login_system.sql

-- 1. Update profiles table to include super_admin role
ALTER TABLE profiles 
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('super_admin', 'admin', 'manager', 'employee', 'part_time'));

-- 2. Create regions table
CREATE TABLE IF NOT EXISTS regions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES profiles(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create store_categories table
CREATE TABLE IF NOT EXISTS store_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  region_id UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES profiles(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(region_id, name)
);

-- 4. Create stores table
CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID NOT NULL REFERENCES store_categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  qr_code_id TEXT UNIQUE NOT NULL,
  qr_secret TEXT NOT NULL, -- Will be encrypted
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  location_radius INT DEFAULT 100, -- meters
  operating_hours JSONB, -- {"mon": {"open": "09:00", "close": "18:00"}, ...}
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create qr_tokens table for secure QR code validation
CREATE TABLE IF NOT EXISTS qr_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  token_type TEXT DEFAULT 'TOTP' CHECK (token_type IN ('TOTP', 'STATIC')),
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 seconds',
  is_used BOOLEAN DEFAULT false,
  used_by UUID REFERENCES employees(id),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create employee_signup_requests table
CREATE TABLE IF NOT EXISTS employee_signup_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  store_id UUID REFERENCES stores(id),
  store_code TEXT, -- Alternative to store_id
  verification_code TEXT,
  verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  approved BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'approved', 'rejected', 'expired')),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Update employees table
ALTER TABLE employees 
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id);

-- 8. Update attendance_records table
ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id),
  ADD COLUMN IF NOT EXISTS qr_validation_token TEXT,
  ADD COLUMN IF NOT EXISTS check_in_method TEXT DEFAULT 'qr' 
    CHECK (check_in_method IN ('qr', 'manual', 'admin')),
  ADD COLUMN IF NOT EXISTS location_lat DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS location_lng DECIMAL(11, 8),
  ADD COLUMN IF NOT EXISTS location_accuracy INT; -- meters

-- 9. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_regions_code ON regions(code);
CREATE INDEX IF NOT EXISTS idx_regions_created_by ON regions(created_by);
CREATE INDEX IF NOT EXISTS idx_store_categories_region ON store_categories(region_id);
CREATE INDEX IF NOT EXISTS idx_stores_category ON stores(category_id);
CREATE INDEX IF NOT EXISTS idx_stores_code ON stores(code);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_store_valid ON qr_tokens(store_id, valid_from, valid_until) 
  WHERE is_used = false;
CREATE INDEX IF NOT EXISTS idx_employee_signup_status ON employee_signup_requests(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_employees_store ON employees(store_id);
CREATE INDEX IF NOT EXISTS idx_attendance_store_date ON attendance_records(store_id, work_date);

-- 10. Enable RLS on new tables
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_signup_requests ENABLE ROW LEVEL SECURITY;

-- 11. RLS Policies for regions
-- Super admins can do everything
CREATE POLICY "Super admins can manage all regions" ON regions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Regional admins can view regions
CREATE POLICY "Regional admins can view regions" ON regions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 12. RLS Policies for store_categories
-- Super admins can manage all
CREATE POLICY "Super admins can manage all store categories" ON store_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Regional admins can manage categories in their regions
CREATE POLICY "Regional admins can manage own region categories" ON store_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() 
      AND p.role = 'admin'
      AND (
        store_categories.created_by = p.id
        OR store_categories.region_id IN (
          SELECT id FROM regions WHERE created_by = p.id
        )
      )
    )
  );

-- 13. RLS Policies for stores
-- Super admins can manage all
CREATE POLICY "Super admins can manage all stores" ON stores
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Regional admins can manage stores in their regions
CREATE POLICY "Regional admins can manage regional stores" ON stores
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN store_categories sc ON sc.id = stores.category_id
      JOIN regions r ON r.id = sc.region_id
      WHERE p.id = auth.uid() 
      AND p.role = 'admin'
      AND r.created_by = p.id
    )
  );

-- Store managers can view their store
CREATE POLICY "Store managers can view own store" ON stores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN employees e ON e.user_id = p.id
      WHERE p.id = auth.uid() 
      AND p.role = 'manager'
      AND e.store_id = stores.id
    )
  );

-- 14. RLS Policies for qr_tokens
-- Only system and admins can manage QR tokens
CREATE POLICY "Admins can manage QR tokens" ON qr_tokens
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin', 'manager')
    )
  );

-- 15. RLS Policies for employee_signup_requests
-- Anyone can create a signup request
CREATE POLICY "Anyone can create signup request" ON employee_signup_requests
  FOR INSERT WITH CHECK (true);

-- Users can view their own requests
CREATE POLICY "Users can view own signup requests" ON employee_signup_requests
  FOR SELECT USING (email = current_setting('request.jwt.claims', true)::json->>'email');

-- Admins and managers can manage requests
CREATE POLICY "Admins can manage signup requests" ON employee_signup_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin', 'manager')
    )
  );

-- 16. Update existing RLS policies to include super_admin
-- Update all admin policies to include super_admin
UPDATE pg_policy 
SET polqual = regexp_replace(polqual::text, 'role = ''admin''', 'role IN (''super_admin'', ''admin'')', 'g')::pg_node_tree
WHERE polname LIKE '%admin%' AND polrelid IN (
  SELECT oid FROM pg_class 
  WHERE relname IN ('profiles', 'employees', 'attendance_records', 'products', 'sales_records', 'documents')
);

-- 17. Create triggers for updated_at
CREATE TRIGGER update_regions_updated_at 
  BEFORE UPDATE ON regions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_categories_updated_at 
  BEFORE UPDATE ON store_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stores_updated_at 
  BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 18. Create function to generate store QR code
CREATE OR REPLACE FUNCTION generate_store_qr_code(store_id UUID)
RETURNS TEXT AS $$
DECLARE
  store_code TEXT;
  qr_id TEXT;
BEGIN
  SELECT code INTO store_code FROM stores WHERE id = store_id;
  qr_id := 'QR_' || store_code || '_' || extract(epoch from now())::text;
  RETURN qr_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 19. Create function to validate QR token
CREATE OR REPLACE FUNCTION validate_qr_token(
  p_token_hash TEXT,
  p_store_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  token_valid BOOLEAN := false;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM qr_tokens
    WHERE token_hash = p_token_hash
    AND store_id = p_store_id
    AND is_used = false
    AND NOW() BETWEEN valid_from AND valid_until
  ) INTO token_valid;
  
  RETURN token_valid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 20. Create function to process employee signup
CREATE OR REPLACE FUNCTION process_employee_signup(
  p_request_id UUID,
  p_approved BOOLEAN,
  p_role TEXT DEFAULT 'employee',
  p_rejection_reason TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_email TEXT;
  v_full_name TEXT;
  v_store_id UUID;
  v_user_id UUID;
BEGIN
  -- Get request details
  SELECT email, full_name, store_id
  INTO v_email, v_full_name, v_store_id
  FROM employee_signup_requests
  WHERE id = p_request_id AND status = 'verified';
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  IF p_approved THEN
    -- Create auth user (this would be done through Supabase Auth API in practice)
    -- For now, just update the request status
    UPDATE employee_signup_requests
    SET 
      approved = true,
      approved_by = auth.uid(),
      approved_at = NOW(),
      status = 'approved'
    WHERE id = p_request_id;
    
    RETURN true;
  ELSE
    -- Reject the request
    UPDATE employee_signup_requests
    SET 
      approved = false,
      approved_by = auth.uid(),
      approved_at = NOW(),
      status = 'rejected',
      rejection_reason = p_rejection_reason
    WHERE id = p_request_id;
    
    RETURN true;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 21. Create view for store attendance overview
CREATE OR REPLACE VIEW store_attendance_overview AS
SELECT 
  s.id as store_id,
  s.name as store_name,
  s.code as store_code,
  DATE(ar.check_in_time) as attendance_date,
  COUNT(DISTINCT ar.employee_id) as total_checkins,
  COUNT(DISTINCT CASE WHEN ar.check_out_time IS NULL THEN ar.employee_id END) as currently_working,
  COUNT(DISTINCT CASE WHEN ar.check_in_method = 'qr' THEN ar.employee_id END) as qr_checkins,
  AVG(EXTRACT(EPOCH FROM (COALESCE(ar.check_out_time, NOW()) - ar.check_in_time))/3600)::DECIMAL(5,2) as avg_work_hours
FROM stores s
LEFT JOIN attendance_records ar ON s.id = ar.store_id
WHERE ar.check_in_time >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY s.id, s.name, s.code, DATE(ar.check_in_time);

-- 22. Grant permissions on views
GRANT SELECT ON store_attendance_overview TO authenticated;

-- 23. Create cleanup function for expired tokens and requests
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS void AS $$
BEGIN
  -- Clean up expired QR tokens
  DELETE FROM qr_tokens
  WHERE valid_until < NOW() - INTERVAL '1 day'
  AND is_used = false;
  
  -- Clean up expired signup requests
  UPDATE employee_signup_requests
  SET status = 'expired'
  WHERE expires_at < NOW()
  AND status = 'pending';
END;
$$ LANGUAGE plpgsql;

-- 24. Insert sample data for testing
-- Insert a sample region
INSERT INTO regions (name, code, created_by) 
SELECT '서울', 'SEOUL', id FROM profiles WHERE role = 'super_admin' LIMIT 1
ON CONFLICT (code) DO NOTHING;

-- Insert a sample store category
INSERT INTO store_categories (region_id, name, description, created_by)
SELECT r.id, '강남구', '서울 강남구 지역 매장들', p.id
FROM regions r, profiles p
WHERE r.code = 'SEOUL' AND p.role = 'super_admin'
LIMIT 1
ON CONFLICT (region_id, name) DO NOTHING;

-- Note: Actual store creation with QR codes should be done through the application
-- to properly generate encrypted secrets and QR code IDs