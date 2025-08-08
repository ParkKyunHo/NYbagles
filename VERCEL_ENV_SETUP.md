# Vercel 환경 변수 설정 가이드

## 필수 환경 변수

Vercel 대시보드에서 다음 환경 변수가 설정되어 있는지 확인하세요:

1. **Vercel 대시보드로 이동**
   - https://vercel.com 로그인
   - NYbagles 프로젝트 선택
   - Settings → Environment Variables

2. **필수 환경 변수 확인**

```
NEXT_PUBLIC_SUPABASE_URL=https://zkvvgohssysenjiitevc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprdnZnb2hzc3lzZW5qaWl0ZXZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5NDIwNjUsImV4cCI6MjA2ODUxODA2NX0.fqiPN8JYvOTmdIB9N24_qzbm81OiG3mU_AY23PAEH0o
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprdnZnb2hzc3lzZW5qaWl0ZXZjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mjk0MjA2NSwiZXhwIjoyMDY4NTE4MDY1fQ.CQld8jjASSZUJL9jP9JMdKroBG33pfkE7nz2JeEAgco
```

3. **환경 변수 적용 범위**
   - Production ✅
   - Preview ✅
   - Development ✅

## 시스템 관리자 로그인 정보

```
이메일: admin@nylovebagel.com
비밀번호: Admin123!@#
```

## 문제 해결

### 로그인 후 자동 로그아웃 문제

1. **브라우저 쿠키 삭제**
   - 개발자 도구 → Application → Storage → Clear site data
   - 또는 시크릿/프라이빗 브라우저 사용

2. **Vercel 재배포**
   - Vercel 대시보드 → Deployments → Redeploy

3. **Supabase Dashboard 확인**
   - Authentication → Users에서 계정 상태 확인
   - 필요시 비밀번호 재설정

### 디버깅 체크리스트

- [ ] Vercel 환경 변수 설정 확인
- [ ] 브라우저 쿠키/캐시 삭제
- [ ] 시크릿 브라우저에서 테스트
- [ ] Supabase Dashboard에서 계정 확인
- [ ] 콘솔 에러 메시지 확인

## 추가 사용자 계정

필요시 Supabase Dashboard에서 직접 생성:
1. Authentication → Users → Invite User
2. 역할 설정: profiles 테이블에서 role 필드 수정
   - super_admin: 시스템 관리자
   - admin: 관리자
   - manager: 매니저
   - employee: 직원
   - part_time: 파트타임