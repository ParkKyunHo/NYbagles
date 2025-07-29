# 관리자 로그인 정보

## 현재 관리자 계정
- **이메일**: admin@nylovebagel.com
- **역할**: super_admin (최고관리자)
- **소속 매장**: NY베이글 강남역점
- **사번**: ADM0001

## 비밀번호 재설정 방법

### 방법 1: Supabase Dashboard에서 재설정
1. [Supabase Dashboard](https://supabase.com/dashboard/project/zkvvgohssysenjiitevc/auth/users) 접속
2. Authentication → Users 메뉴
3. admin@nylovebagel.com 찾기
4. 우측 ... 메뉴 → "Send password recovery" 클릭
5. 이메일로 비밀번호 재설정 링크 전송됨

### 방법 2: 테스트용 비밀번호로 직접 설정
Supabase Dashboard SQL Editor에서:
```sql
-- 관리자 비밀번호를 'Admin123!@#'로 설정
-- 주의: 이 방법은 개발/테스트 환경에서만 사용하세요
UPDATE auth.users 
SET encrypted_password = crypt('Admin123!@#', gen_salt('bf'))
WHERE email = 'admin@nylovebagel.com';
```

### 방법 3: 프로그래밍 방식으로 재설정
```javascript
// Supabase Admin API를 사용한 비밀번호 재설정
const { data, error } = await supabase.auth.admin.updateUserById(
  '62bc540b-10e8-4db6-8a51-dd0a75ac0d96',
  { password: 'Admin123!@#' }
)
```

## 문제 해결 완료

✅ **viewport 경고 해결**: layout.tsx 파일 수정 완료
✅ **관리자 employee 레코드 생성**: ADM0001 사번으로 생성됨
✅ **store_id NULL 문제 해결**: 모든 직원에게 매장 할당됨

## 로그인 테스트
1. http://localhost:3000/login 접속
2. 이메일: admin@nylovebagel.com
3. 비밀번호: (위 방법으로 설정한 비밀번호)

비밀번호를 재설정하면 정상적으로 로그인할 수 있습니다.