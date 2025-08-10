# 뉴욕러브베이글 통합 관리 시스템

Next.js 14와 Supabase를 활용한 베이글샵 통합 관리 시스템입니다.

🌐 **프로덕션 사이트**: [Vercel에 배포됨]

## 주요 기능

- 🔐 **통합 인증 시스템**: 엔터프라이즈급 통합 인증 (`/lib/auth/unified-auth`)
- 📱 **QR 출퇴근**: QR코드 기반 출퇴근 관리
  - 매장별 고유 QR 코드 (30초마다 자동 갱신)
  - 직원 QR 코드 스캔을 통한 출퇴근 기록
  - TOTP 기반 보안 토큰
- 💰 **판매 관리**: 터치 친화적 실시간 판매 입력
- 💵 **급여 관리**: 간편한 시급 × 근무시간 계산 시스템
  - 직원별 시급 설정
  - 자동 근무시간 집계
  - 실시간 급여 계산
- 👥 **직원 관리**: 계층적 권한 시스템
  - 최상위 관리자 (super_admin): 전체 시스템 관리
  - 지역 관리자 (admin): 지역별 매장 관리
  - 매장 관리자 (manager): 매장 직원 관리
  - 직원 (employee/part_time): 본인 출퇴근 기록
- 🏢 **매장 관리**: 지역별 카테고리 기반 매장 관리
- 📊 **매출 분석**: 실시간 대시보드 및 리포트
- 📄 **문서 관리**: 직원 서류 디지털 보관 및 만료 알림
  - 문서 업로드 및 관리
  - 만료일 자동 알림
  - 카테고리별 분류
- 📱 **PWA 지원**: 오프라인 사용 가능

## 기술 스택

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **보안**: TOTP 기반 QR 인증, Row Level Security (RLS)
- **배포**: Vercel (자동 CI/CD)
- **모니터링**: Vercel Analytics

## 시작하기

### 1. 환경 변수 설정

`.env.local.example`을 `.env.local`로 복사하고 Supabase 정보를 입력하세요:

```bash
cp .env.local.example .env.local
```

### 2. 의존성 설치

```bash
npm install
```

### 3. Supabase 설정

1. [Supabase](https://supabase.com)에서 새 프로젝트 생성
2. SQL 에디터에서 마이그레이션 파일 실행:
   - `/supabase/migrations/20240101000000_initial_schema.sql` (기본 스키마)
   - `/supabase/migrations/20240125000000_add_qr_login_system.sql` (QR 로그인 시스템)
3. 프로젝트 URL과 anon key를 `.env.local`에 입력

### 4. 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000 에서 확인하세요.

## 프로젝트 구조

```
bagel-shop/
├── app/                    # Next.js App Router
│   ├── (auth)/            # 인증 관련 페이지
│   │   └── signup/
│   │       └── employee/  # 직원 회원가입
│   ├── (dashboard)/       # 대시보드 페이지
│   ├── api/               # API 라우트
│   └── demo/              # 데모 페이지
├── components/            # 재사용 컴포넌트
│   ├── auth/              # 인증 관련 컴포넌트
│   ├── qr/                # QR 코드 관련 컴포넌트
│   └── ui/                # UI 컴포넌트
├── lib/                   # 유틸리티 및 설정
│   └── supabase/         # Supabase 클라이언트
├── types/                # TypeScript 타입 정의
├── public/               # 정적 파일 (PWA 아이콘 등)
├── supabase/            # 데이터베이스 마이그레이션
└── docs/                # 프로젝트 문서
```

## 배포

프로젝트는 GitHub 리포지토리와 Vercel이 연결되어 자동 배포됩니다.

### 자동 배포 프로세스
- **main 브랜치**: 프로덕션 환경 자동 배포
- **feature 브랜치**: 프리뷰 환경 자동 생성

### 환경 변수 설정

Vercel 대시보드에서 다음 환경 변수를 설정하세요:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

자세한 배포 가이드는 [VERCEL_DEPLOYMENT_GUIDE.md](./VERCEL_DEPLOYMENT_GUIDE.md)를 참조하세요.

## 개발 가이드

### 🚨 필수 인증 시스템 사용 규칙

새로운 페이지나 기능을 개발할 때 **반드시** 통합 인증 시스템을 사용하세요:

```typescript
// ✅ 올바른 사용
import { requireAuth, requireRole } from '@/lib/auth/unified-auth'

// ❌ 잘못된 사용 (레거시 시스템 사용 금지!)
import { getAuthUser } from '@/lib/auth/server-auth'  // 사용 금지!
```

자세한 개발 가이드는 [CLAUDE.md](./CLAUDE.md)의 **개발 가이드** 섹션을 참조하세요.

## 코드 수정 및 업데이트

코드 수정 후 자동 배포 프로세스는 [UPDATE_GUIDE.md](./UPDATE_GUIDE.md)를 참조하세요.

## 보안 고려사항

- Row Level Security (RLS) 정책이 모든 테이블에 적용됨
- 역할 기반 접근 제어 (RBAC) 구현
- 민감한 정보는 환경 변수로 관리
- HTTPS 필수

## 라이선스

MIT

## 로컬 개발 환경 실행 방법
1. PowerShell에서 `wsl` 입력
2. `cd /home/albra/NYbalges/bagel-shop`
3. `npm run dev`

## 최근 업데이트 (2025-08-10)
- 🔐 **통합 인증 시스템 구현** (`/lib/auth/unified-auth`)
  - 모든 대시보드 접근 문제 해결
  - 중복 인증 코드 제거 및 성능 최적화
  - 엔터프라이즈급 보안 강화
- 📝 **코드 규칙 문서화** 
  - 인증 시스템 사용 가이드
  - 데이터베이스 컬럼명 확인 규칙
  - 개발 체크리스트 추가

## 이전 업데이트 (2025-08-04)
- 상품 관리 시스템 개선
- 매장별 상품 표시 기능 추가
- UI/UX 개선 (텍스트 가독성 향상)