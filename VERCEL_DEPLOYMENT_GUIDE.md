# Vercel 배포 가이드

이 문서는 베이글샵 관리 시스템을 Vercel에 배포하는 방법을 안내합니다.

## 1. 사전 준비

### 필수 항목
- GitHub 계정 (완료: https://github.com/ParkKyunHo/NYbagles.git)
- Vercel 계정 (https://vercel.com에서 GitHub으로 가입)
- Supabase 프로젝트 (완료: zkvvgohssysenjiitevc)

## 2. Vercel 배포 단계

### 2.1 Vercel 가입 및 프로젝트 연결

1. https://vercel.com 접속
2. "Sign Up" 클릭 → "Continue with GitHub" 선택
3. GitHub 계정으로 로그인
4. Vercel 대시보드에서 "New Project" 클릭
5. GitHub 리포지토리 목록에서 "NYbagles" 선택
6. "Import" 클릭

### 2.2 환경 변수 설정

프로젝트 설정 페이지에서 다음 환경 변수를 추가하세요:

```
NEXT_PUBLIC_SUPABASE_URL=https://zkvvgohssysenjiitevc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[Supabase 대시보드에서 복사]
SUPABASE_SERVICE_ROLE_KEY=[Supabase 대시보드에서 복사]
```

#### 환경 변수 가져오는 방법:
1. https://supabase.com/dashboard 접속
2. 프로젝트 선택
3. 좌측 메뉴에서 "Settings" → "API" 클릭
4. 다음 값들을 복사:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ 비밀키: 절대 노출 금지)

### 2.3 빌드 설정

기본 설정을 그대로 사용:
- Framework Preset: Next.js (자동 감지됨)
- Build Command: `npm run build`
- Output Directory: `.next`
- Install Command: `npm install`

### 2.4 배포 시작

1. "Deploy" 버튼 클릭
2. 배포 진행 상황 모니터링 (약 2-5분 소요)
3. 성공 시 고유 URL 생성됨 (예: `nybagles-xxx.vercel.app`)

## 3. 배포 후 설정

### 3.1 도메인 설정 (선택사항)

1. Vercel 프로젝트 설정 → "Domains" 탭
2. 사용할 도메인 입력 (예: `nybagles.com`)
3. DNS 설정 안내에 따라 도메인 연결

### 3.2 Supabase URL 허용 목록 추가

1. Supabase 대시보드 → Authentication → URL Configuration
2. "Redirect URLs"에 다음 추가:
   - `https://[your-vercel-url].vercel.app/**`
   - `https://[your-custom-domain]/**` (커스텀 도메인 사용 시)

### 3.3 환경별 관리

- **개발**: `localhost:3000`
- **스테이징**: `[project]-[branch].vercel.app`
- **프로덕션**: `[project].vercel.app` 또는 커스텀 도메인

## 4. Vercel 무료 플랜 제한사항

### 리소스 제한
- **대역폭**: 100GB/월
- **서버리스 함수 실행**: 100GB-시간/월
- **빌드 시간**: 6,000분/월
- **동시 빌드**: 1개
- **엣지 미들웨어**: 1,000,000 호출/월

### 예상 사용량 (중소 규모 베이글샵 기준)
- 직원 50명, 일일 평균 200건 거래
- 예상 월간 대역폭: ~10GB
- 예상 함수 실행: ~20GB-시간
- **결론**: 무료 플랜으로 충분

### 모니터링
- Vercel 대시보드에서 실시간 사용량 확인 가능
- 제한 도달 시 이메일 알림

## 5. 자동 배포 설정

GitHub에 코드를 푸시하면 자동으로 배포됩니다:

```bash
git add .
git commit -m "Update features"
git push origin main
```

### 브랜치별 배포
- `main` 브랜치: 프로덕션 환경
- 기타 브랜치: 프리뷰 환경 (각 PR마다 고유 URL 생성)

## 6. 문제 해결

### 빌드 실패 시
1. Vercel 대시보드에서 빌드 로그 확인
2. 환경 변수 설정 확인
3. `npm run build` 로컬에서 테스트

### 500 에러 발생 시
1. 함수 로그 확인 (Functions 탭)
2. Supabase 연결 상태 확인
3. 환경 변수 값 검증

### 성능 최적화
1. 이미지 최적화: Next.js Image 컴포넌트 사용
2. 정적 생성: 가능한 페이지는 SSG 활용
3. 캐싱: 적절한 캐시 헤더 설정

## 7. 보안 권장사항

1. **환경 변수 보호**
   - `SUPABASE_SERVICE_ROLE_KEY`는 서버 사이드에서만 사용
   - 클라이언트 코드에 비밀키 노출 금지

2. **CORS 설정**
   - Vercel 도메인만 허용하도록 Supabase 설정

3. **Rate Limiting**
   - API 라우트에 rate limiting 적용 (이미 구현됨)

## 8. 모니터링 및 분석

### Vercel Analytics (무료)
- 실시간 트래픽 모니터링
- 성능 지표 (Core Web Vitals)
- 에러 추적

### 활성화 방법
1. Vercel 프로젝트 → Analytics 탭
2. "Enable Analytics" 클릭

## 다음 단계

배포가 완료되면:
1. 프로덕션 URL로 접속하여 테스트
2. 초기 관리자 계정 생성
3. 직원들에게 접속 URL 공유
4. 정기적인 백업 설정 (Supabase 대시보드에서)

---

문의사항이 있으면 Vercel 문서(https://vercel.com/docs)를 참고하세요.