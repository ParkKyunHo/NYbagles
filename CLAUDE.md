# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important Notes

- Always check for existing patterns before implementing new features
- 한글로 답변하세요
- 날짜와 시간은 대한민국 시간을 따르도록 하세요.
- Follow the established code style and conventions
- Update this file as the codebase evolves
- Don't stop reading code until understanding perfect
- Before fixing and making new code, Find existing code first
- Fix a code, step by step

## Repository Status - 2025년 8월 9일 최신 업데이트

베이글샵 통합 관리 시스템 - **인증 시스템 재설계 및 서버 컴포넌트 마이그레이션 진행 중**

### 🚀 배포 정보
- **프로덕션 사이트**: https://nybagles.vercel.app
- **GitHub**: https://github.com/ParkKyunHo/NYbagles.git
- **자동 배포**: main 브랜치 푸시 시 자동 배포

### 🏗️ 최근 시스템 재설계 (2025년 8월 9일)

#### 1. 인증 시스템 통합 ✅
- **문제점**: 
  - 서버 컴포넌트, 클라이언트 컴포넌트, 미들웨어에서 각각 다른 인증 처리
  - 대시보드 클릭 시 리다이렉션 문제 발생
  - Supabase 데이터 로딩 실패

- **해결책**:
  - `/lib/auth/server-auth.ts` - 서버 사이드 인증 통합
  - `/contexts/AuthContext.tsx` - 클라이언트 상태 관리
  - 미들웨어 단순화 (인증만 체크, 권한은 페이지에서)

#### 2. 서버 컴포넌트 마이그레이션 (진행 중)
- **완료**: 
  - `/app/(dashboard)/dashboard/quick-sale/page.tsx` - 서버 컴포넌트로 전환
  - `/app/(dashboard)/dashboard/quick-sale/QuickSaleClient.tsx` - 클라이언트 인터랙션 분리
  - `/app/api/sales/quick/route.ts` - Server Action 구현

- **대기 중**:
  - 판매 관련 페이지들 (/sales/*)
  - 상품 관리 페이지들 (/products/*)
  - 직원 관리 페이지들 (/dashboard/employees/*)

### 📊 개선된 시스템 아키텍처

#### 폴더 구조 계획
```
app/
├── (public)/              # 인증 불필요
│   ├── login/
│   └── signup/
├── (authenticated)/       # 인증 필요 (통합 레이아웃)
│   ├── layout.tsx        # 인증/권한 체크 중앙화
│   ├── dashboard/
│   ├── sales/
│   └── products/
└── api/                  # Server Actions & API Routes
    └── actions/          # Server Actions
```

#### 인증 플로우
1. **미들웨어**: 로그인 여부만 확인
2. **레이아웃**: 사용자 정보 및 권한 데이터 제공
3. **페이지**: 역할 기반 접근 제어 및 데이터 페칭

#### 데이터 페칭 전략
- **서버 우선**: 초기 데이터는 서버 컴포넌트에서
- **Server Actions**: 클라이언트 인터랙션 처리
- **Streaming**: Suspense를 활용한 점진적 렌더링

### 📊 데이터베이스 구조

#### 메인 테이블 (2025년 8월 8일 정리)
- **products**: 메인 상품 테이블 (products_v3에서 이름 변경)
- **sales_transactions / sales_items**: 판매 트랜잭션
- **product_changes**: 상품 변경 승인 워크플로우
- **inventory_movements**: 재고 이동 추적
- **profiles**: 사용자 프로필 및 권한
- **employees**: 직원 정보 및 매장 연결
- **stores**: 매장 정보

#### 권한 시스템
- super_admin: 전체 시스템 관리
- admin: 전체 매장 관리
- manager: 단일 매장 관리
- employee: 판매 및 기본 업무
- part_time: 파트타임 직원

### 📁 핵심 파일 위치

#### 새로운 인증 시스템
- `/lib/auth/server-auth.ts` - 서버 사이드 인증 통합 ⭐
- `/contexts/AuthContext.tsx` - 클라이언트 Context ⭐
- `/hooks/useAuthCheck.ts` - 레거시 인증 훅 (점진적 마이그레이션 중)

#### 서버 컴포넌트 예시
- `/app/(dashboard)/dashboard/quick-sale/page.tsx` - 서버 컴포넌트 예시
- `/app/(dashboard)/dashboard/quick-sale/QuickSaleClient.tsx` - 클라이언트 분리

#### 주요 페이지
- `/app/(dashboard)/dashboard/employees/page.tsx` - 직원 관리
- `/app/(dashboard)/sales/simple/page.tsx` - 간편 판매
- `/app/(dashboard)/products/v2/page.tsx` - 상품 관리
- `/app/(dashboard)/products/approvals/page.tsx` - 상품 승인

### 🛠️ 개발 가이드

#### 새 페이지 작성 시 (서버 컴포넌트)
```typescript
// page.tsx (서버 컴포넌트)
import { requireRole } from '@/lib/auth/server-auth'

export default async function PageName() {
  const user = await requireRole(['admin', 'manager'])
  // 서버에서 데이터 페칭
  const data = await fetchData()
  
  return <ClientComponent data={data} user={user} />
}
```

#### 클라이언트 컴포넌트 분리
```typescript
'use client'
// ClientComponent.tsx
export default function ClientComponent({ data, user }) {
  // 인터랙션 로직
}
```

### ⚠️ 주의사항

1. **테이블 이름**: `products` 테이블 사용 (products_v3 아님)
2. **인증 시스템**: 새 페이지는 `/lib/auth/server-auth.ts` 사용
3. **미들웨어**: 권한 체크 하지 않음 (인증만)
4. **서버 컴포넌트**: 가능한 모든 페이지를 서버 컴포넌트로
5. **RLS 정책**: profiles 테이블 정책 수정 시 순환 참조 주의

### 📝 TODO (우선순위 순)

#### 즉시 처리
- [x] 대시보드 리다이렉션 문제 해결
- [x] Supabase 세션 관리 개선
- [x] 인증 시스템 통합

#### 진행 중
- [ ] 서버 컴포넌트 마이그레이션
  - [x] 간편판매 페이지
  - [ ] 판매 관련 페이지들
  - [ ] 상품 관리 페이지들
  - [ ] 직원 관리 페이지들

#### 추후 작업
- [ ] 성능 최적화
  - [ ] Next.js 캐싱 전략
  - [ ] 이미지 최적화
  - [ ] 번들 사이즈 감소
- [ ] 에러 처리 개선
  - [ ] Error boundaries 구현
  - [ ] 404/500 페이지 개선
  - [ ] 사용자 친화적 메시지
- [ ] 알림 시스템 구현
- [ ] 백업/복구 시스템 구현

### 🔗 관련 문서
- README.md - 프로젝트 개요 및 설치 가이드
- PROJECT_STATUS.md - 상세 프로젝트 현황

### 📌 다음 작업자를 위한 메모

현재 시스템 재설계가 진행 중입니다. 주요 변경 사항:

1. **인증 시스템이 통합되었습니다**: 새 페이지 작성 시 `/lib/auth/server-auth.ts` 사용
2. **서버 컴포넌트 우선**: 클라이언트 컴포넌트는 인터랙션만 처리
3. **미들웨어 단순화**: 권한 체크는 페이지에서 처리

작업 시작 전 반드시 `/app/(dashboard)/dashboard/quick-sale/` 폴더의 구현을 참고하세요.