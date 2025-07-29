-- Add Schedule Management System
-- Migration: 20250127000000_add_schedule_system.sql

-- 1. Create work_schedules table (주간/월간 스케줄 등록)
CREATE TABLE IF NOT EXISTS work_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  schedule_date DATE NOT NULL,
  shift_start TIME NOT NULL,
  shift_end TIME NOT NULL,
  break_minutes INTEGER DEFAULT 0,
  schedule_type TEXT DEFAULT 'regular' CHECK (schedule_type IN ('regular', 'overtime', 'holiday', 'special')),
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'cancelled', 'completed')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, schedule_date, shift_start)
);

-- 2. Create schedule_change_requests table (스케줄 변경 요청)
CREATE TABLE IF NOT EXISTS schedule_change_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID REFERENCES work_schedules(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id),
  request_type TEXT NOT NULL CHECK (request_type IN ('swap', 'cancel', 'modify')),
  swap_with_employee_id UUID REFERENCES employees(id),
  new_date DATE,
  new_start_time TIME,
  new_end_time TIME,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create schedule_templates table (반복 스케줄 템플릿)
CREATE TABLE IF NOT EXISTS schedule_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create schedule_template_items table (템플릿 상세)
CREATE TABLE IF NOT EXISTS schedule_template_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES schedule_templates(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
  shift_start TIME NOT NULL,
  shift_end TIME NOT NULL,
  break_minutes INTEGER DEFAULT 0,
  required_employees INTEGER DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_work_schedules_employee ON work_schedules(employee_id, schedule_date);
CREATE INDEX IF NOT EXISTS idx_work_schedules_store ON work_schedules(store_id, schedule_date);
CREATE INDEX IF NOT EXISTS idx_work_schedules_date ON work_schedules(schedule_date);
CREATE INDEX IF NOT EXISTS idx_schedule_change_requests_status ON schedule_change_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_schedule_templates_store ON schedule_templates(store_id, is_active);

-- 6. Enable RLS on new tables
ALTER TABLE work_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_template_items ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for work_schedules
-- Employees can view their own schedules
CREATE POLICY "Employees can view own schedules" ON work_schedules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = work_schedules.employee_id
      AND e.user_id = auth.uid()
    )
  );

-- Managers and admins can manage schedules for their stores
CREATE POLICY "Managers can manage store schedules" ON work_schedules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN employees e ON e.user_id = p.id
      WHERE p.id = auth.uid() 
      AND (
        p.role IN ('super_admin', 'admin')
        OR (p.role = 'manager' AND e.store_id = work_schedules.store_id)
      )
    )
  );

-- 8. RLS Policies for schedule_change_requests
-- Employees can create and view their own requests
CREATE POLICY "Employees can manage own change requests" ON schedule_change_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = schedule_change_requests.employee_id
      AND e.user_id = auth.uid()
    )
  );

-- Managers can view and approve requests
CREATE POLICY "Managers can manage change requests" ON schedule_change_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN employees e ON e.user_id = p.id
      WHERE p.id = auth.uid() 
      AND p.role IN ('super_admin', 'admin', 'manager')
    )
  );

-- 9. RLS Policies for schedule_templates
-- Managers and admins can manage templates
CREATE POLICY "Managers can manage schedule templates" ON schedule_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN employees e ON e.user_id = p.id
      WHERE p.id = auth.uid() 
      AND (
        p.role IN ('super_admin', 'admin')
        OR (p.role = 'manager' AND e.store_id = schedule_templates.store_id)
      )
    )
  );

-- Everyone can view active templates
CREATE POLICY "Everyone can view active templates" ON schedule_templates
  FOR SELECT USING (is_active = true);

-- 10. RLS Policies for schedule_template_items
-- Same as template policies
CREATE POLICY "Managers can manage template items" ON schedule_template_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM schedule_templates st
      JOIN profiles p ON p.id = auth.uid()
      LEFT JOIN employees e ON e.user_id = p.id
      WHERE st.id = schedule_template_items.template_id
      AND (
        p.role IN ('super_admin', 'admin')
        OR (p.role = 'manager' AND e.store_id = st.store_id)
      )
    )
  );

-- 11. Create triggers for updated_at
CREATE TRIGGER update_work_schedules_updated_at 
  BEFORE UPDATE ON work_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedule_change_requests_updated_at 
  BEFORE UPDATE ON schedule_change_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedule_templates_updated_at 
  BEFORE UPDATE ON schedule_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 12. Create view for weekly schedule overview
CREATE OR REPLACE VIEW weekly_schedule_overview AS
SELECT 
  ws.schedule_date,
  ws.store_id,
  s.name as store_name,
  ws.employee_id,
  CONCAT(p.full_name, ' (', p.role, ')') as employee_name,
  ws.shift_start,
  ws.shift_end,
  ws.break_minutes,
  ws.schedule_type,
  ws.status,
  EXTRACT(HOUR FROM (ws.shift_end - ws.shift_start)) - (ws.break_minutes::DECIMAL / 60) as scheduled_hours
FROM work_schedules ws
JOIN employees e ON e.id = ws.employee_id
JOIN profiles p ON p.id = e.user_id
JOIN stores s ON s.id = ws.store_id
WHERE ws.schedule_date >= CURRENT_DATE - INTERVAL '7 days'
  AND ws.schedule_date <= CURRENT_DATE + INTERVAL '14 days'
ORDER BY ws.schedule_date, ws.store_id, ws.shift_start;

-- 13. Create function to generate weekly schedules from template
CREATE OR REPLACE FUNCTION generate_schedules_from_template(
  p_template_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_employee_assignments JSONB -- [{"day_of_week": 1, "employee_id": "uuid", "shift_start": "09:00"}]
) RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_current_date DATE;
  v_assignment JSONB;
  v_template_item RECORD;
BEGIN
  -- Validate dates
  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'End date must be after start date';
  END IF;
  
  -- Loop through each date in range
  v_current_date := p_start_date;
  WHILE v_current_date <= p_end_date LOOP
    -- For each assignment in the JSON array
    FOR v_assignment IN SELECT * FROM jsonb_array_elements(p_employee_assignments) LOOP
      -- Find matching template item
      FOR v_template_item IN 
        SELECT * FROM schedule_template_items 
        WHERE template_id = p_template_id 
        AND day_of_week = EXTRACT(DOW FROM v_current_date)
        AND shift_start = (v_assignment->>'shift_start')::TIME
      LOOP
        -- Create schedule entry
        INSERT INTO work_schedules (
          employee_id,
          store_id,
          schedule_date,
          shift_start,
          shift_end,
          break_minutes,
          created_by
        )
        SELECT 
          (v_assignment->>'employee_id')::UUID,
          st.store_id,
          v_current_date,
          v_template_item.shift_start,
          v_template_item.shift_end,
          v_template_item.break_minutes,
          auth.uid()
        FROM schedule_templates st
        WHERE st.id = p_template_id
        ON CONFLICT (employee_id, schedule_date, shift_start) DO NOTHING;
        
        v_count := v_count + 1;
      END LOOP;
    END LOOP;
    
    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. Create function to check schedule conflicts
CREATE OR REPLACE FUNCTION check_schedule_conflict(
  p_employee_id UUID,
  p_schedule_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_exclude_schedule_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_conflict BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM work_schedules
    WHERE employee_id = p_employee_id
    AND schedule_date = p_schedule_date
    AND status NOT IN ('cancelled')
    AND (p_exclude_schedule_id IS NULL OR id != p_exclude_schedule_id)
    AND (
      (shift_start <= p_start_time AND shift_end > p_start_time)
      OR (shift_start < p_end_time AND shift_end >= p_end_time)
      OR (shift_start >= p_start_time AND shift_end <= p_end_time)
    )
  ) INTO v_conflict;
  
  RETURN v_conflict;
END;
$$ LANGUAGE plpgsql;

-- 15. Grant permissions on views
GRANT SELECT ON weekly_schedule_overview TO authenticated;

-- 16. Insert sample schedule template
INSERT INTO schedule_templates (store_id, name, description, created_by)
SELECT s.id, '평일 기본 스케줄', '월-금 기본 운영 스케줄', p.id
FROM stores s, profiles p
WHERE s.code = 'GANGNAM001' AND p.role = 'super_admin'
LIMIT 1
ON CONFLICT DO NOTHING;