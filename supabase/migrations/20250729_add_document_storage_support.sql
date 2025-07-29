-- Add document storage support
-- Migration: 20250729_add_document_storage_support.sql

-- Storage bucket은 Supabase Dashboard에서 수동으로 생성해야 합니다.
-- 아래 설정으로 생성하세요:
-- - Name: documents
-- - Public: ❌ (비공개)
-- - File size limit: 50MB
-- - Allowed MIME types: application/pdf,image/jpeg,image/jpg,image/png

-- 1. documents 테이블에 storage_path 추가 (이미 file_url이 있지만 더 명확하게)
ALTER TABLE documents 
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS file_size INTEGER,
  ADD COLUMN IF NOT EXISTS mime_type TEXT;

-- 2. storage.objects에 대한 RLS 정책 생성
-- (Storage bucket 생성 후 실행)
-- Storage RLS는 Supabase Dashboard에서 설정하거나 아래 정책을 사용

-- 3. documents 테이블 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_documents_employee_id ON documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_documents_document_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_expiry_date ON documents(expiry_date);

-- 4. 문서 만료 알림을 위한 뷰 생성
CREATE OR REPLACE VIEW documents_expiring_soon AS
SELECT 
  d.*,
  e.full_name as employee_name,
  e.store_id,
  s.name as store_name,
  CASE 
    WHEN d.expiry_date < CURRENT_DATE THEN 'expired'
    WHEN d.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
    ELSE 'valid'
  END as status
FROM documents d
JOIN employees e ON d.employee_id = e.id
LEFT JOIN stores s ON e.store_id = s.id
WHERE d.expiry_date IS NOT NULL;

-- 5. 문서 업로드 로그 테이블 생성
CREATE TABLE IF NOT EXISTS document_upload_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('upload', 'update', 'delete')),
  performed_by UUID REFERENCES profiles(id),
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  details JSONB
);

-- 6. 문서 업로드 로그 RLS 정책
ALTER TABLE document_upload_logs ENABLE ROW LEVEL SECURITY;

-- 관리자는 모든 로그 조회 가능
CREATE POLICY "Admins can view all document logs" ON document_upload_logs
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('super_admin', 'admin')
    )
  );

-- 매니저는 자기 매장 직원의 문서 로그만 조회 가능
CREATE POLICY "Managers can view their store document logs" ON document_upload_logs
  FOR SELECT USING (
    auth.uid() IN (
      SELECT p.id FROM profiles p
      JOIN employees e ON p.id = e.user_id
      WHERE p.role = 'manager'
      AND e.store_id IN (
        SELECT store_id FROM employees emp
        JOIN documents d ON emp.id = d.employee_id
        WHERE d.id = document_upload_logs.document_id
      )
    )
  );

-- 7. 문서 통계를 위한 함수
CREATE OR REPLACE FUNCTION get_document_statistics(p_store_id UUID DEFAULT NULL)
RETURNS TABLE (
  total_documents INTEGER,
  expired_documents INTEGER,
  expiring_soon INTEGER,
  documents_by_type JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_documents,
    COUNT(CASE WHEN expiry_date < CURRENT_DATE THEN 1 END)::INTEGER as expired_documents,
    COUNT(CASE WHEN expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days' THEN 1 END)::INTEGER as expiring_soon,
    jsonb_object_agg(
      document_type,
      type_count
    ) as documents_by_type
  FROM (
    SELECT 
      d.document_type,
      COUNT(*) as type_count,
      d.expiry_date
    FROM documents d
    JOIN employees e ON d.employee_id = e.id
    WHERE (p_store_id IS NULL OR e.store_id = p_store_id)
    GROUP BY d.document_type, d.expiry_date
  ) doc_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. 문서 업로드 트리거
CREATE OR REPLACE FUNCTION log_document_action()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO document_upload_logs (document_id, action, performed_by, details)
    VALUES (NEW.id, 'upload', NEW.uploaded_by, jsonb_build_object(
      'file_name', NEW.file_name,
      'document_type', NEW.document_type
    ));
  ELSIF TG_OP = 'UPDATE' AND OLD.file_url != NEW.file_url THEN
    INSERT INTO document_upload_logs (document_id, action, performed_by, details)
    VALUES (NEW.id, 'update', auth.uid(), jsonb_build_object(
      'old_file', OLD.file_name,
      'new_file', NEW.file_name
    ));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO document_upload_logs (document_id, action, performed_by, details)
    VALUES (OLD.id, 'delete', auth.uid(), jsonb_build_object(
      'file_name', OLD.file_name,
      'document_type', OLD.document_type
    ));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER document_action_logger
  AFTER INSERT OR UPDATE OR DELETE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION log_document_action();

-- 9. 코멘트 추가
COMMENT ON TABLE document_upload_logs IS '문서 업로드/수정/삭제 이력';
COMMENT ON COLUMN documents.storage_path IS 'Supabase Storage 내 파일 경로';
COMMENT ON COLUMN documents.file_size IS '파일 크기 (bytes)';
COMMENT ON COLUMN documents.mime_type IS '파일 MIME 타입';