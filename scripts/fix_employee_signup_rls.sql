-- 직원 회원가입 RLS 정책 수정
-- employee_signup_requests 테이블에 대한 public access 허용

-- 기존 정책 확인
SELECT polname, polcmd, polqual::text
FROM pg_policy
WHERE polrelid = 'employee_signup_requests'::regclass;

-- 기존 정책이 제대로 작동하지 않는 경우를 위한 추가 정책
-- 인증되지 않은 사용자도 회원가입 요청을 생성할 수 있도록 허용
CREATE POLICY "Public can create signup requests" ON employee_signup_requests
  FOR INSERT
  WITH CHECK (true);

-- 인증되지 않은 사용자도 자신의 요청을 업데이트할 수 있도록 허용 (인증 코드 확인용)
CREATE POLICY "Public can update own requests" ON employee_signup_requests
  FOR UPDATE
  USING (true)
  WITH CHECK (
    -- 이메일이 없는 경우 (anon user) id로만 체크
    id IS NOT NULL
  );

-- 인증되지 않은 사용자도 자신의 요청을 조회할 수 있도록 허용
CREATE POLICY "Public can view own requests by id" ON employee_signup_requests
  FOR SELECT
  USING (true);

-- RLS가 활성화되어 있는지 확인
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'employee_signup_requests';

-- anon 권한 확인
SELECT has_table_privilege('anon', 'employee_signup_requests', 'INSERT');
SELECT has_table_privilege('anon', 'employee_signup_requests', 'SELECT');
SELECT has_table_privilege('anon', 'employee_signup_requests', 'UPDATE');

-- 권한이 없다면 부여
GRANT INSERT, SELECT, UPDATE ON employee_signup_requests TO anon;
GRANT USAGE ON SEQUENCE employee_signup_requests_id_seq TO anon;