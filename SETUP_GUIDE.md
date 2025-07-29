# 베이글샵 통합 관리 시스템 - 설정 가이드

## 🚀 빠른 시작

### 1. 환경 변수 설정

1. `.env.template` 파일을 복사하여 `.env.local` 파일 생성:
```bash
cp .env.template .env.local
```

2. Supabase 프로젝트 정보 입력:
   - `NEXT_PUBLIC_SUPABASE_URL`: Supabase 프로젝트 URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase Anonymous Key
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase Service Role Key (관리자 작업용)

3. Service Role Key 찾기:
   - Supabase 대시보드 → Settings → API
   - "Service role key" 섹션에서 복사
   - ⚠️ **주의**: 이 키는 절대 클라이언트에 노출되거나 Git에 커밋되면 안 됩니다!

### 2. 초기 데이터 설정

```bash
# 의존성 설치
npm install

# 데이터베이스 시드 실행
npm run seed
```

시드 스크립트는 다음을 생성합니다:
- **Super Admin 계정**: admin@nybalges.com / Admin123!@#
- **테스트 매장**: 강남역점, 삼성점, 광화문점, 홍대점
- **샘플 직원**:
  - 매니저: manager@nybalges.com / Manager123!
  - 정직원: employee1@nybalges.com / Employee123!
  - 파트타임: parttime1@nybalges.com / Parttime123!

⚠️ **보안 주의**: 프로덕션 환경에서는 즉시 비밀번호를 변경하세요!

### 3. 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000 에서 애플리케이션에 접속할 수 있습니다.

## 🔐 보안 설정

### Rate Limiting
현재 구성된 제한:
- **일반 API**: 분당 60회
- **인증 API**: 15분당 5회
- **QR 생성**: 분당 30회

### CORS 설정
`ALLOWED_ORIGINS` 환경 변수에 허용할 도메인을 쉼표로 구분하여 추가:
```
ALLOWED_ORIGINS=http://localhost:3000,https://your-domain.com
```

### 보안 헤더
자동으로 적용되는 보안 헤더:
- Strict-Transport-Security (HSTS)
- Content-Security-Policy (CSP)
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection
- Referrer-Policy

## 📱 QR 코드 시스템

### QR 코드 동작 방식
1. 매장 QR 코드는 30초마다 자동 갱신
2. TOTP (Time-based One-Time Password) 기반
3. 직원이 QR 스캔 시 자동으로 출퇴근 기록

### QR 스캐너 활성화
`ENABLE_QR_SCANNER=true` 환경 변수로 제어

### 위치 기반 검증
`ENABLE_LOCATION_CHECK=true`로 설정하면 GPS 위치 확인 기능 활성화

## 🧪 테스트 시나리오

### 1. 관리자 로그인
1. http://localhost:3000/login 접속
2. admin@nybalges.com / Admin123!@# 로그인
3. 관리자 대시보드 확인

### 2. 직원 회원가입 프로세스
1. http://localhost:3000/signup/employee 접속
2. 정보 입력 및 매장 코드 입력 (예: GANGNAM001)
3. 이메일 인증 (개발 환경에서는 자동)
4. 관리자 승인 대기

### 3. QR 출퇴근 테스트
1. 관리자로 로그인 → 매장 관리 → QR 코드 보기
2. 직원 계정으로 로그인
3. QR 출퇴근 메뉴에서 스캔
4. 출퇴근 기록 확인

## 🛠️ 문제 해결

### Supabase 연결 오류
- Service Role Key가 올바른지 확인
- Supabase 프로젝트가 활성화되어 있는지 확인
- 네트워크 연결 상태 확인

### 시드 스크립트 오류
- `.env.local`에 `SUPABASE_SERVICE_ROLE_KEY`가 설정되어 있는지 확인
- 이미 존재하는 데이터인 경우 스킵됨 (정상)

### Rate Limiting 429 오류
- 너무 많은 요청을 보낸 경우
- 잠시 기다린 후 재시도
- 개발 환경에서는 `middleware.ts`에서 임시로 비활성화 가능

## 📚 추가 문서

- [프로젝트 인덱스](./PROJECT_INDEX.md)
- [프로젝트 진행 상황](./PROGRESS.md)
- [API 문서](./PROJECT_INDEX.md#api-문서)
- [데이터베이스 스키마](./PROJECT_INDEX.md#데이터베이스-스키마)

---

도움이 필요하시면 프로젝트 관리자에게 문의하세요.