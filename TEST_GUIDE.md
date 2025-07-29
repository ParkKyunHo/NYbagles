# 뉴욕러브베이글 통합 관리 시스템 테스트 가이드

## 🚀 애플리케이션 실행

```bash
# 개발 서버 실행
npm run dev
```

애플리케이션이 http://localhost:3000 에서 실행됩니다.

## 🧪 회원가입 테스트 방법

### 1. 직원 회원가입 테스트

1. **회원가입 페이지 접속**
   - http://localhost:3000/signup 접속
   - "직원으로 회원가입" 버튼 클릭

2. **회원가입 정보 입력**
   ```
   이메일: test.employee@nylovebagel.com
   비밀번호: Employee123!
   이름: 테스트직원
   전화번호: 010-1234-5678
   역할: 직원 (Employee)
   ```

3. **회원가입 요청 제출**
   - 폼 작성 후 "회원가입 요청" 버튼 클릭
   - 승인 대기 메시지 확인

### 2. 관리자 계정 설정 (Supabase 대시보드 사용)

현재 seed 스크립트 실행 시 에러가 발생하여 Supabase 대시보드에서 직접 설정해야 합니다:

1. **Supabase 대시보드 접속**
   - https://supabase.com/dashboard 로그인
   - 프로젝트 선택

2. **SQL Editor에서 관리자 생성**
   ```sql
   -- 1. 테스트 관리자 생성
   INSERT INTO auth.users (
     email,
     encrypted_password,
     email_confirmed_at,
     raw_user_meta_data,
     created_at,
     updated_at
   ) VALUES (
     'admin@nylovebagel.com',
     crypt('Admin123!@#', gen_salt('bf')),
     now(),
     '{"full_name": "시스템 관리자", "role": "super_admin"}'::jsonb,
     now(),
     now()
   );

   -- 2. 서울 지역 생성
   INSERT INTO regions (name, code, is_active)
   VALUES ('서울', 'SEOUL', true);

   -- 3. 강남구 카테고리 생성 (region_id는 위에서 생성된 ID 사용)
   INSERT INTO store_categories (region_id, name, description, is_active)
   SELECT id, '강남구', '서울 강남구 지역 매장들', true
   FROM regions WHERE code = 'SEOUL';

   -- 4. 테스트 매장 생성 (category_id는 위에서 생성된 ID 사용)
   INSERT INTO stores (
     category_id,
     name,
     code,
     address,
     phone,
     email,
     qr_code_id,
     qr_secret,
     location_lat,
     location_lng,
     location_radius,
     operating_hours,
     is_active
   )
   SELECT 
     sc.id,
     '뉴욕러브베이글 강남역점',
     'GANGNAM001',
     '서울시 강남구 테헤란로 123',
     '02-1234-5678',
     'gangnam@nylovebagel.com',
     'QR_GANGNAM001_' || extract(epoch from now()),
     encode(gen_random_bytes(32), 'hex'),
     37.498095,
     127.027610,
     100,
     '{
       "mon": {"open": "09:00", "close": "22:00"},
       "tue": {"open": "09:00", "close": "22:00"},
       "wed": {"open": "09:00", "close": "22:00"},
       "thu": {"open": "09:00", "close": "22:00"},
       "fri": {"open": "09:00", "close": "22:00"},
       "sat": {"open": "10:00", "close": "22:00"},
       "sun": {"open": "10:00", "close": "21:00"}
     }'::jsonb,
     true
   FROM store_categories sc
   JOIN regions r ON sc.region_id = r.id
   WHERE r.code = 'SEOUL' AND sc.name = '강남구';
   ```

3. **관리자 로그인**
   - 이메일: admin@nylovebagel.com
   - 비밀번호: Admin123!@#

## 📱 QR 코드 스캔 테스트

### 1. 직원 로그인 후 QR 스캔
1. 승인된 직원 계정으로 로그인
2. 대시보드에서 "출퇴근 관리" 클릭
3. "QR 코드 스캔" 버튼 클릭
4. 카메라 권한 허용
5. 매장 QR 코드 스캔

### 2. 매장 QR 코드 확인
- 관리자로 로그인 후 매장 관리 페이지에서 QR 코드 확인
- QR 코드는 30초마다 자동 갱신됨

## 🎨 브랜딩 확인 사항

- **색상 테마**: 노란색(#FDB813)과 검정색(#1A1A1A) 조합
- **매장명**: 뉴욕러브베이글
- **반응형 디자인**: 모바일, 태블릿, 데스크톱 지원

## ⚠️ 주의사항

1. **환경 변수 설정 필수**
   - `.env.local` 파일에 Supabase URL과 키가 설정되어 있어야 함

2. **카메라 권한**
   - QR 스캔을 위해 브라우저에서 카메라 권한 허용 필요
   - HTTPS 환경에서만 카메라 사용 가능 (localhost는 예외)

3. **테스트 데이터**
   - 실제 운영 환경에서는 테스트 계정 삭제 필수
   - 비밀번호는 즉시 변경 권장

## 📝 문제 해결

### "Database error creating new user" 에러 발생 시
- Supabase 대시보드에서 migrations 폴더의 SQL 파일들이 모두 실행되었는지 확인
- Auth → Settings에서 "Enable email confirmations" 옵션 확인

### QR 스캔이 작동하지 않을 때
- 브라우저 콘솔에서 에러 메시지 확인
- 카메라 권한이 차단되지 않았는지 확인
- HTTPS 또는 localhost 환경인지 확인