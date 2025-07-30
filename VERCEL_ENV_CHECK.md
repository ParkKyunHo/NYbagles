# Vercel 환경 변수 확인 가이드

## 필수 환경 변수

Vercel Dashboard에서 다음 환경 변수가 설정되어 있는지 확인하세요:

1. **NEXT_PUBLIC_SUPABASE_URL**
   - 예: `https://zkvvgohssysenjiitevc.supabase.co`
   - Public 변수 (클라이언트 사이드에서 사용)

2. **NEXT_PUBLIC_SUPABASE_ANON_KEY**
   - Supabase Dashboard > Settings > API에서 확인
   - Public 변수 (클라이언트 사이드에서 사용)

3. **SUPABASE_SERVICE_ROLE_KEY** (중요!)
   - Supabase Dashboard > Settings > API에서 확인
   - Secret 변수 (서버 사이드에서만 사용)
   - **이 키가 없으면 Internal Server Error 발생**

## Vercel에서 환경 변수 설정 방법

1. Vercel Dashboard 접속
2. 프로젝트 선택
3. Settings → Environment Variables
4. 위 3개 변수 모두 추가
5. **Production**, **Preview**, **Development** 모두 체크
6. Save 후 재배포

## 로그 확인 방법

1. Vercel Dashboard → Functions 탭
2. `api/auth/signup/employee` 함수 클릭
3. Logs 확인하여 정확한 에러 메시지 확인

## 디버깅 팁

API 응답에 포함된 `message` 필드를 확인하면 더 자세한 오류 정보를 볼 수 있습니다.