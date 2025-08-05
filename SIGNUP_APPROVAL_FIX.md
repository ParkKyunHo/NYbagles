# 가입승인 오류 해결 가이드

## 문제
"사용자 생성 실패" 오류가 발생하는 원인은 Vercel 환경변수에 `SUPABASE_SERVICE_ROLE_KEY`가 설정되지 않았기 때문입니다.

## 해결 방법

### 1. Supabase에서 Service Role Key 가져오기
1. https://supabase.com/dashboard 접속
2. 프로젝트 선택 (zkvvgohssysenjiitevc)
3. 좌측 메뉴에서 **Settings** → **API** 클릭
4. **Service Role** 섹션에서 `service_role` 키 복사 (눈 아이콘 클릭하여 표시)
   - ⚠️ 이 키는 매우 중요한 비밀키입니다. 절대 공개하지 마세요!

### 2. Vercel에 환경변수 추가
1. https://vercel.com 접속 및 로그인
2. 프로젝트 선택
3. **Settings** 탭 클릭
4. 좌측 메뉴에서 **Environment Variables** 클릭
5. 다음 환경변수 추가:
   - Key: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: [위에서 복사한 service_role 키]
   - Environment: Production, Preview, Development 모두 체크
6. **Save** 버튼 클릭

### 3. 재배포
환경변수를 추가한 후 자동으로 재배포가 시작됩니다. 
만약 자동으로 시작되지 않으면:
1. **Deployments** 탭으로 이동
2. 최신 배포의 ... 메뉴 클릭
3. **Redeploy** 선택

### 4. 확인
재배포가 완료되면 가입승인이 정상적으로 작동합니다.

## 주의사항
- Service Role Key는 서버 측에서만 사용되어야 합니다
- 절대 클라이언트 코드나 공개 저장소에 노출하지 마세요
- 이 키가 노출되면 즉시 Supabase에서 재생성해야 합니다