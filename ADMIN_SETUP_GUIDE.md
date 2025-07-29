# 관리자 계정 설정 가이드

## 개요
베이글샵 통합 관리 시스템의 관리자 계정을 생성하는 방법을 안내합니다.

## 현재 상태 (2025년 7월 27일)
- ✅ 데이터베이스 테이블 생성 완료
- ✅ 지역 데이터 생성 완료 (서울, 경기, 부산)
- ✅ 매장 카테고리 생성 완료 (강남구, 종로구, 마포구)
- ✅ 샘플 매장 생성 완료
  - NY베이글 강남역점 (QR_GANGNAM001_1753580114781)
  - NY베이글 삼성점 (QR_SAMSUNG001_1753580115023)
- ⚠️ 관리자 계정은 수동으로 생성 필요

## 관리자 계정 생성 방법

### 방법 1: Auth 이슈 해결 후 생성 (권장)

1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. 프로젝트 선택 (NY베이글)
3. **SQL Editor로 이동하여 다음 스크립트 실행**:
   ```bash
   # 로컬 파일 위치
   /scripts/fix_auth_issue.sql
   ```
   또는 아래 SQL 직접 실행:
   ```sql
   -- Step 1: 트리거 임시 비활성화
   DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

   -- Step 2: CHECK 제약 조건 수정
   ALTER TABLE profiles 
   DROP CONSTRAINT IF EXISTS profiles_role_check;

   ALTER TABLE profiles 
   ADD CONSTRAINT profiles_role_check 
   CHECK (role IN ('super_admin', 'admin', 'manager', 'employee', 'part_time'));

   -- Step 3: 트리거 재활성화
   CREATE TRIGGER on_auth_user_created
     AFTER INSERT ON auth.users
     FOR EACH ROW EXECUTE FUNCTION handle_new_user();
   ```

4. Authentication > Users 메뉴로 이동
5. "Create user" 버튼 클릭
6. 다음 정보 입력:
   - Email: `admin@nylovebagel.com`
   - Password: `Admin123!@#`
   - Auto Confirm User: ✅ 체크
7. 사용자 생성 후, SQL Editor로 돌아가서:
   ```sql
   UPDATE profiles 
   SET role = 'super_admin', 
       full_name = '시스템 관리자'
   WHERE email = 'admin@nylovebagel.com';
   ```

### 방법 2: SQL Script 사용

1. Supabase Dashboard > SQL Editor로 이동
2. `/supabase/seed/01_initial_admin.sql` 파일의 내용 복사
3. SQL Editor에 붙여넣기 후 실행

### 방법 3: 웹 인터페이스 사용 (개발 중)

현재 Auth 관련 이슈로 프로그래밍 방식의 계정 생성에 문제가 있습니다.
Supabase의 handle_new_user 트리거나 RLS 정책 관련 설정을 확인해야 합니다.

## 테스트 계정 정보

### Super Admin (생성 필요)
- Email: `admin@nylovebagel.com`
- Password: `Admin123!@#`
- Role: `super_admin`

### 기타 테스트 계정 (추후 생성 예정)
- Manager: `manager@nybalges.com` / `Manager123!`
- Employee: `employee1@nybalges.com` / `Employee123!`
- Part-time: `parttime1@nybalges.com` / `Parttime123!`

## 시스템 접속 방법

1. 개발 서버 실행:
   ```bash
   npm run dev
   ```

2. 브라우저에서 http://localhost:3000 접속

3. 관리자 계정으로 로그인

## 주요 기능 테스트

1. **QR 코드 확인**
   - 대시보드에서 매장 QR 코드 확인
   - 30초마다 자동 갱신되는지 확인

2. **직원 가입 승인**
   - 직원이 회원가입 요청 시 관리자 승인 필요
   - Admin > 가입 요청 메뉴에서 확인

3. **출퇴근 기록**
   - QR 스캐너로 직원 QR 코드 스캔
   - 출퇴근 기록 자동 생성 확인

## 문제 해결

### Auth 오류 발생 시
- Supabase Dashboard에서 직접 사용자 생성
- Auth > Policies에서 정책 확인
- Database > Functions에서 handle_new_user 함수 확인

### 데이터베이스 초기화 필요 시
```bash
# 테이블 확인
npx tsx scripts/checkTables.ts

# 데이터 재생성
npx tsx scripts/initializeTestData.ts
```

## 다음 단계

1. 관리자 계정 생성 완료
2. QR 코드 스캔 테스트
3. 직원 회원가입 및 승인 프로세스 테스트
4. 스케줄 관리 시스템 구현
5. 급여 계산 자동화 구현
6. 매출 입력 및 분석 기능 구현