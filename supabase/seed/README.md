# Supabase 초기 데이터 설정 가이드

## 📋 개요

Supabase Auth의 "Database error creating new user" 문제를 해결하고 초기 테스트 데이터를 설정하는 SQL 스크립트입니다.

## 🚀 실행 순서

### 1. Supabase 대시보드 접속
1. [Supabase Dashboard](https://app.supabase.com)에 로그인
2. 프로젝트 선택
3. 왼쪽 메뉴에서 **SQL Editor** 클릭

### 2. 스크립트 실행 (순서대로)

#### Step 1: 관리자 계정 생성
```sql
-- 01_initial_admin.sql 내용을 복사하여 실행
```
- 최상위 관리자 계정 생성
- 트리거 문제 임시 해결
- 생성된 계정: `admin@nylovebagel.com` / `Admin123!@#`

#### Step 2: 초기 데이터 생성
```sql
-- 02_initial_data.sql 내용을 복사하여 실행
```
- 지역: 서울, 경기, 인천
- 매장: 강남역점, 삼성점, 광화문점, 홍대점
- 테스트 계정:
  - 매니저: `manager@nylovebagel.com` / `Manager123!`
  - 정직원: `employee@nylovebagel.com` / `Employee123!`
  - 파트타임: `parttime@nylovebagel.com` / `Parttime123!`

## 📝 테스트 계정 정보

| 역할 | 이메일 | 비밀번호 | 소속 매장 |
|------|--------|----------|-----------|
| 최상위 관리자 | admin@nylovebagel.com | Admin123!@# | - |
| 매니저 | manager@nylovebagel.com | Manager123! | 강남역점 |
| 정직원 | employee@nylovebagel.com | Employee123! | 강남역점 |
| 파트타임 | parttime@nylovebagel.com | Parttime123! | 강남역점 |

## 🔍 데이터 확인

SQL Editor에서 다음 쿼리로 생성된 데이터를 확인할 수 있습니다:

```sql
-- 사용자 확인
SELECT email, created_at FROM auth.users ORDER BY created_at DESC;

-- 프로필 확인
SELECT * FROM profiles ORDER BY created_at DESC;

-- 매장 확인
SELECT * FROM stores;

-- 직원 배정 확인
SELECT 
  p.full_name,
  p.role,
  s.name as store_name
FROM profiles p
LEFT JOIN employees e ON p.id = e.user_id
LEFT JOIN stores s ON e.store_id = s.id;
```

## ⚠️ 주의사항

1. **프로덕션 환경에서는 사용하지 마세요!** 이 스크립트는 개발/테스트용입니다.
2. 비밀번호는 반드시 변경하세요.
3. `qr_secret`은 자동으로 랜덤 생성됩니다.
4. 트리거 임시 비활성화/재활성화가 포함되어 있습니다.

## 🐛 문제 해결

### "Database error creating new user" 에러가 계속 발생하는 경우:
1. Supabase Dashboard → Authentication → Policies 확인
2. Email confirmations 설정 확인
3. Custom SMTP 설정 확인

### 데이터가 생성되지 않는 경우:
1. RLS 정책 확인
2. 테이블 존재 여부 확인
3. 마이그레이션 파일이 모두 실행되었는지 확인