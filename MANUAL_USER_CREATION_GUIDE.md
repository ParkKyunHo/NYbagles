# 수동 사용자 생성 가이드

## Supabase Dashboard에서 직접 사용자 생성하기

### 1단계: 가입 요청 확인
1. Supabase SQL Editor에서 다음 쿼리 실행:

```sql
-- 대기 중인 가입 요청 확인
SELECT * FROM employee_signup_requests 
WHERE status = 'pending' OR status = 'verified'
ORDER BY created_at DESC;
```

### 2단계: 수동으로 사용자 생성
1. Supabase Dashboard → **Authentication** → **Users** 탭
2. **Add user** → **Send invitation** 클릭
3. 가입 요청의 이메일 입력
4. **Send invitation** 클릭

### 3단계: 프로필과 직원 레코드 생성
SQL Editor에서 다음 쿼리 실행:

```sql
-- 1. 생성된 사용자 ID 확인
SELECT id, email, created_at 
FROM auth.users 
WHERE email = '직원_이메일@example.com';

-- 2. 프로필 생성 (위에서 얻은 user_id 사용)
INSERT INTO profiles (id, full_name, email, role, store_id)
VALUES (
  '위에서_얻은_user_id',
  '직원 이름',
  '직원_이메일@example.com',
  'employee',
  '매장_ID'
);

-- 3. 직원 레코드 생성
INSERT INTO employees (user_id, store_id, hourly_rate, is_active)
VALUES (
  '위에서_얻은_user_id',
  '매장_ID',
  10500,
  true
);

-- 4. 가입 요청 상태 업데이트
UPDATE employee_signup_requests
SET 
  status = 'approved',
  approved = true,
  approved_at = NOW(),
  approved_by = '시스템_관리자_ID'
WHERE email = '직원_이메일@example.com';
```

### 4단계: 확인
```sql
-- 모든 테이블에서 확인
SELECT 
  u.id,
  u.email,
  p.full_name,
  p.role,
  e.hourly_rate,
  e.is_active
FROM auth.users u
JOIN profiles p ON u.id = p.id
JOIN employees e ON e.user_id = u.id
WHERE u.email = '직원_이메일@example.com';
```

## 트러블슈팅

### 매장 ID 찾기
```sql
SELECT id, name, code FROM stores WHERE is_active = true;
```

### 시스템 관리자 ID 찾기
```sql
SELECT id, email FROM auth.users WHERE email = '시스템관리자이메일';
```

### 가입 요청 정보 확인
```sql
SELECT * FROM employee_signup_requests WHERE status != 'approved';
```

## 자동화 복구

위 수동 과정이 성공하면, 이후 가입 승인은 자동으로 작동해야 합니다.
만약 계속 실패한다면 데이터베이스 트리거를 확인해야 합니다.