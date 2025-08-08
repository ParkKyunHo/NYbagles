# 관리자 계정 설정 가이드

## Supabase 대시보드에서 관리자 생성

1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. Authentication → Users 메뉴
3. "Invite user" 버튼 클릭
4. 이메일 입력 후 초대 메일 발송
5. SQL Editor에서 역할 설정:
```sql
UPDATE profiles 
SET role = 'super_admin' 
WHERE email = 'admin@example.com';
```

## 역할 권한 체계
- `super_admin`: 전체 시스템 관리
- `admin`: 전체 매장 관리
- `manager`: 단일 매장 관리
- `employee`: 판매 직원
- `part_time`: 파트타임 직원