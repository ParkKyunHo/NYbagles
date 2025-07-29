# 오류 수정 가이드

## 1. 판매 입력 페이지 오류 수정

### 문제
- "직원 정보가 등록되지 않았습니다" 메시지 출력
- 원인: employees 테이블에 store_id가 NULL인 직원 레코드 존재

### 해결 방법

1. **Supabase Dashboard에서 SQL 실행**
   ```sql
   -- Fix employee store assignments
   -- This migration ensures all employees have a store_id assigned

   -- First, let's check if there are any employees without store_id
   DO $$
   DECLARE
       unassigned_count INTEGER;
       default_store_id UUID;
   BEGIN
       -- Count employees without store_id
       SELECT COUNT(*) INTO unassigned_count
       FROM employees
       WHERE store_id IS NULL;
       
       IF unassigned_count > 0 THEN
           -- Get the first active store as default
           SELECT id INTO default_store_id
           FROM stores
           WHERE is_active = true
           ORDER BY created_at
           LIMIT 1;
           
           IF default_store_id IS NOT NULL THEN
               -- Update all employees without store_id
               UPDATE employees
               SET store_id = default_store_id
               WHERE store_id IS NULL;
               
               RAISE NOTICE 'Updated % employees with default store_id: %', unassigned_count, default_store_id;
           ELSE
               RAISE EXCEPTION 'No active stores found to assign employees to';
           END IF;
       END IF;
   END $$;

   -- Make store_id NOT NULL to prevent future issues
   ALTER TABLE employees ALTER COLUMN store_id SET NOT NULL;
   ```

2. **또는 특정 매장에 직원 할당**
   ```sql
   -- 먼저 매장 목록 확인
   SELECT id, name, code FROM stores WHERE is_active = true;
   
   -- 특정 직원을 특정 매장에 할당 (user_id로)
   UPDATE employees 
   SET store_id = '매장ID여기입력'
   WHERE user_id = '사용자ID여기입력';
   
   -- 또는 모든 store_id가 NULL인 직원을 특정 매장에 할당
   UPDATE employees 
   SET store_id = '매장ID여기입력'
   WHERE store_id IS NULL;
   ```

## 2. 문서 관리 페이지 접근 오류 수정

### 문제
- 문서 관리 클릭 시 대시보드로 리다이렉트
- 원인: 프로필 정보를 제대로 불러오지 못함

### 해결 완료
- `/app/(dashboard)/dashboard/documents/page.tsx` 파일 수정 완료
- 프로필 로드 실패 시 더 명확한 에러 메시지 표시

### 추가 확인 사항

1. **프로필 데이터 확인**
   ```sql
   -- 현재 사용자의 프로필 확인
   SELECT * FROM profiles WHERE id = '로그인한사용자ID';
   
   -- 모든 auth.users가 profiles에 있는지 확인
   SELECT au.id, au.email, p.id as profile_id
   FROM auth.users au
   LEFT JOIN profiles p ON au.id = p.id
   WHERE p.id IS NULL;
   ```

2. **만약 프로필이 없다면 생성**
   ```sql
   -- auth.users에는 있지만 profiles에 없는 사용자의 프로필 생성
   INSERT INTO profiles (id, email, full_name, role)
   SELECT 
       au.id,
       au.email,
       COALESCE(au.raw_user_meta_data->>'full_name', 'Unknown User'),
       'employee'
   FROM auth.users au
   LEFT JOIN profiles p ON au.id = p.id
   WHERE p.id IS NULL;
   ```

## 테스트 방법

1. **판매 페이지 테스트**
   - SQL 실행 후 로그아웃
   - 다시 로그인
   - `/sales` 페이지 접속
   - 정상적으로 판매 입력 화면이 나타나는지 확인

2. **문서 관리 페이지 테스트**
   - `/dashboard/documents` 페이지 접속
   - 정상적으로 문서 관리 화면이 나타나는지 확인
   - Storage bucket이 없다면 Supabase Dashboard에서 'documents' bucket 생성 필요