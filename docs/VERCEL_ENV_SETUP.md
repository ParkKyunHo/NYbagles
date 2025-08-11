# Vercel 환경변수 설정 가이드

## 필수 환경변수

Vercel 대시보드에서 다음 환경변수들을 설정해야 합니다:

### 1. Supabase 환경변수

```bash
# Public 환경변수 (클라이언트에서 사용)
NEXT_PUBLIC_SUPABASE_URL=your-project-url.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Secret 환경변수 (서버에서만 사용) - 중요!
SUPABASE_SERVICE_KEY=your-service-role-key
```

## 설정 방법

### 1. Vercel 대시보드 접속
1. https://vercel.com 로그인
2. 프로젝트 선택 (NYbagels)
3. Settings 탭 클릭

### 2. Environment Variables 설정
1. Settings → Environment Variables 메뉴 클릭
2. 각 환경변수 추가:

#### NEXT_PUBLIC_SUPABASE_URL
- Key: `NEXT_PUBLIC_SUPABASE_URL`
- Value: Supabase 프로젝트 URL (예: `https://xxxxx.supabase.co`)
- Environment: Production, Preview, Development 모두 체크

#### NEXT_PUBLIC_SUPABASE_ANON_KEY
- Key: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Value: Supabase Anon Key
- Environment: Production, Preview, Development 모두 체크

#### SUPABASE_SERVICE_KEY (중요!)
- Key: `SUPABASE_SERVICE_KEY`
- Value: Supabase Service Role Key
- Environment: Production, Preview, Development 모두 체크
- **Sensitive 체크** ✅ (보안상 중요)

### 3. Supabase에서 키 찾기
1. https://supabase.com/dashboard 로그인
2. 프로젝트 선택
3. Settings → API 메뉴
4. 다음 값들 복사:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon public → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role secret → `SUPABASE_SERVICE_KEY`

### 4. 배포 후 확인
환경변수 설정 후 재배포가 필요합니다:
1. Deployments 탭으로 이동
2. 최신 배포의 ... 메뉴 클릭
3. Redeploy 선택
4. "Use existing Build Cache" 체크 해제
5. Redeploy 클릭

## 디버깅

### 환경변수 확인 방법
배포 후 콘솔에서 다음과 같은 로그를 확인할 수 있습니다:

```
[Admin Client] Environment check: {
  hasUrl: true,
  urlLength: 55,
  hasServiceKey: true,
  keyLength: 223,
  keyPrefix: "eyJhbGciOiJIUzI1...",
  nodeEnv: "production",
  isVercel: true
}
```

### 문제 해결

#### 1. "Missing SUPABASE_SERVICE_KEY" 오류
- Vercel 대시보드에서 `SUPABASE_SERVICE_KEY` 환경변수가 설정되어 있는지 확인
- 키 이름이 정확한지 확인 (SUPABASE_SERVICE_ROLE_KEY 아님)
- 재배포 필요

#### 2. "Server Components render" 오류
- 환경변수가 모두 설정되어 있는지 확인
- Service Key가 올바른지 확인 (Anon Key와 혼동하지 않았는지)
- 캐시 없이 재배포

#### 3. RLS 정책 오류
- Service Key를 사용하면 RLS를 우회할 수 있음
- 그럼에도 오류가 발생하면 Supabase 대시보드에서 RLS 정책 확인

## 보안 주의사항

⚠️ **중요**: 
- `SUPABASE_SERVICE_KEY`는 절대 클라이언트 코드에 노출되면 안됩니다
- GitHub에 커밋하지 마세요
- Vercel에서 Sensitive로 표시하세요
- 로컬 개발 시 `.env.local` 파일 사용 (`.gitignore`에 포함됨)

## 로컬 개발 환경

로컬에서 테스트하려면 `.env.local` 파일 생성:

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your-project-url.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
```

이 파일은 Git에 커밋되지 않습니다.