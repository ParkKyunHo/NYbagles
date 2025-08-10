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

## Repository Status - 2025년 8월 10일 최신 업데이트

베이글샵 통합 관리 시스템 - **서버 컴포넌트 마이그레이션 완료 및 최적화 진행 중**

### 🚀 배포 정보
- **프로덕션 사이트**: https://nybagles.vercel.app
- **GitHub**: https://github.com/ParkKyunHo/NYbagles.git
- **자동 배포**: main 브랜치 푸시 시 자동 배포

### 🏗️ 최근 시스템 재설계 (2025년 8월 10일)

#### 🎯 통합 인증 시스템 구현 완료 (2025년 8월 10일) ✅

#### 문제점 해결
- **원인**: employees 테이블이 user_id 컬럼 사용 (profile_id 아님)
- **해결**: 데이터베이스 스키마 확인 후 올바른 컬럼 사용
- **구현**: `/lib/auth/unified-auth.ts` - 엔터프라이즈급 통합 인증 시스템

#### 통합 인증 시스템 특징
- **캐싱**: React cache 함수로 요청당 한 번만 인증 체크
- **중복 제거**: 모든 인증 로직을 단일 모듈로 통합
- **엔터프라이즈급**: 비활성 사용자/매장 체크, 역할 기반 접근 제어
- **성능 최적화**: Admin 클라이언트로 RLS 우회, 병렬 데이터 페칭

#### 인증 API
```typescript
// 기본 인증 (캐시됨)
const user = await requireAuth()

// 역할 기반 인증
const user = await requireRole(['admin', 'manager'])

// 페이지별 접근 권한
const user = await checkPageAccess('/admin/stores')

// 매장별 접근 권한
const user = await checkStoreAccess(storeId)

// API 라우트용 (리다이렉트 없음)
const user = await getAuthUserForAPI()
```

### 🆕 SaaS급 모듈화 시스템 구현 ✅
- **문제점**:
  - 모듈 간 의존성 높음
  - 한 모듈의 오류가 다른 모듈에 영향
  - 재시도 및 복구 메커니즘 부재
  - 테스트 자동화 미비

- **해결책**:
  - `/lib/core/` - 의존성 주입 컨테이너 구현
  - `/lib/resilience/` - Circuit Breaker, Retry, Fallback 패턴
  - `/lib/modules/` - 독립적인 서비스 모듈 (Sales, Products)
  - E2E 테스트 자동화 (Playwright, 1초 딜레이)

#### 1. 인증 시스템 통합 ✅
- **문제점**: 
  - 서버 컴포넌트, 클라이언트 컴포넌트, 미들웨어에서 각각 다른 인증 처리
  - 대시보드 클릭 시 리다이렉션 문제 발생
  - Supabase 데이터 로딩 실패

- **해결책**:
  - `/lib/auth/server-auth.ts` - 서버 사이드 인증 통합
  - `/contexts/AuthContext.tsx` - 클라이언트 상태 관리
  - 미들웨어 단순화 (인증만 체크, 권한은 페이지에서)

#### 2. 서버 컴포넌트 마이그레이션 ✅
- **완료된 페이지**: 
  - `/app/(dashboard)/dashboard/quick-sale/` - 간편 판매
  - `/app/(dashboard)/sales/summary/` - 매출 요약 (캐싱 적용)
  - `/app/(dashboard)/sales/history/` - 판매 내역
  - `/app/(dashboard)/products/` - 상품 관리
  - `/app/(dashboard)/dashboard/employees/` - 직원 관리 (2025년 8월 9일 완료)

- **구현된 기능**:
  - `/lib/data/sales.data.ts` - 판매 데이터 레이어 (캐싱)
  - `/lib/data/products.data.ts` - 상품 데이터 레이어 (캐싱)
  - `/lib/data/employees.data.ts` - 직원 데이터 레이어 (캐싱)
  - `/lib/actions/sales.actions.ts` - 판매 Server Actions
  - `/lib/actions/products.actions.ts` - 상품 Server Actions
  - `/lib/actions/employees.actions.ts` - 직원 Server Actions
  - 에러 바운더리 및 로딩 상태 구현

- **대기 중**:
  - 직원 상세 페이지 (/dashboard/employees/[id])
  - 급여 관리 페이지 (/dashboard/salary)
  - 기타 클라이언트 컴포넌트 페이지들

### 📊 개선된 시스템 아키텍처

#### 모듈화된 시스템 구조 (2025년 8월 10일 업데이트)
```
lib/
├── core/                    # 의존성 주입 시스템
│   ├── container.ts        # DI 컨테이너
│   ├── decorators.ts       # 데코레이터 (@Injectable, @Inject 등)
│   └── types.ts            # 핵심 타입 정의
├── resilience/             # 복원력 패턴
│   ├── circuit-breaker.ts  # Circuit Breaker 패턴
│   ├── retry-policy.ts     # 재시도 정책
│   └── fallback.ts         # Fallback 메커니즘
├── modules/                # 비즈니스 모듈
│   ├── sales/              # 판매 모듈 (완료)
│   │   ├── sales.service.ts
│   │   ├── sales.repository.ts
│   │   ├── sales.errors.ts
│   │   └── sales.module.ts
│   └── products/           # 상품 모듈 (완료)
│       ├── products.service.ts
│       ├── products.repository.ts
│       ├── products.errors.ts
│       └── products.module.ts
└── tests/e2e/              # E2E 테스트
    ├── fixtures/           # 테스트 픽스처
    ├── pages/              # Page Object Model
    └── specs/              # 테스트 시나리오
```

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

### 📋 직원 관리 시스템 구현 (2025년 8월 9일)

#### 구현된 기능
1. **서버 컴포넌트 전환**
   - 직원 목록 페이지를 서버 컴포넌트로 전환
   - 클라이언트 인터랙션 부분만 분리

2. **데이터 레이어 (`/lib/data/employees.data.ts`)**
   - `getEmployees`: 직원 목록 조회 (5분 캐싱)
   - `getEmployeeStats`: 직원 통계 (10분 캐싱)
   - `getAttendanceRecords`: 출근 기록 (1분 캐싱 - 실시간성)
   - `getSalaryCalculations`: 급여 계산 내역 (5분 캐싱)
   - `getMonthlyWorkSummary`: 월간 근무 요약 (5분 캐싱)
   - `getDepartments`: 부서 목록 (1시간 캐싱)

3. **Server Actions (`/lib/actions/employees.actions.ts`)**
   - `createEmployee`: 트랜잭션 기반 직원 생성 (Auth + Profile + Employee)
   - `updateEmployee`: 직원 정보 수정
   - `deactivateEmployee`: 직원 비활성화 및 로그인 차단
   - `activateEmployee`: 직원 재활성화
   - `checkIn/checkOut`: 출퇴근 체크
   - `calculateSalary`: 급여 계산

4. **권한 관리**
   - super_admin/admin: 모든 직원 관리
   - manager: 자기 매장 직원만 관리
   - 역할별 기능 제한 적용

### 🔧 자주 발생하는 오류 및 해결 가이드

#### 0. 대시보드 접근 시 홈으로 리다이렉트되는 문제
**증상**: 로그인 성공 후 대시보드 클릭 시 홈으로 돌아감
**원인**: 
- 서버 컴포넌트에서 잘못된 인증 시스템 사용
- 데이터베이스 컬럼명 불일치 (user_id vs profile_id)
- 중복 인증 체크로 인한 세션 충돌

**해결책**:
```typescript
// 1. 통합 인증 시스템 사용
import { requireAuth } from '@/lib/auth/unified-auth'

// 2. 올바른 컬럼명 사용
.eq('user_id', user.id)  // employees 테이블

// 3. 중복 인증 제거
// 미들웨어는 인증만, 권한은 페이지에서
```

#### 1. Supabase RLS 정책 오류
**문제**: `new row violates row-level security policy` 
**원인**: profiles 테이블 RLS 정책과 employees 테이블 간 순환 참조
**해결책**:
```sql
-- Admin 클라이언트 사용하여 RLS 우회
const adminClient = createAdminClient()
```

#### 2. 트랜잭션 롤백 처리
**문제**: 직원 생성 중 일부 단계 실패
**해결책**:
```typescript
// Auth 사용자 생성 실패 시 자동 롤백
if (profileError) {
  await adminClient.auth.admin.deleteUser(authData.user.id)
  throw profileError
}
```

#### 3. 캐시 무효화 누락
**문제**: 데이터 변경 후 UI 업데이트 안됨
**해결책**:
```typescript
revalidateTag('employees')  // 태그 기반 무효화
revalidateTag('stats')      // 관련 통계도 함께
revalidatePath('/dashboard/employees')  // 경로 무효화
```

#### 4. 병렬 페칭 최적화
**문제**: 순차적 데이터 페칭으로 느린 로딩
**해결책**:
```typescript
const [employees, stats, stores, departments] = await Promise.all([
  getEmployees(filters),
  getEmployeeStats(storeId),
  getStores(),
  getDepartments()
])
```

#### 5. 권한 체크 누락
**문제**: 매니저가 다른 매장 직원 수정 가능
**해결책**:
```typescript
if (user.role === 'manager' && existingEmployee.store_id !== user.storeId) {
  throw new Error('다른 매장의 직원 정보를 수정할 수 없습니다')
}
```

### 🛠️ 개발 가이드

#### 🚨 필수 코드 규칙 (재발 방지)

##### 1. 인증 시스템 사용 규칙
```typescript
// ✅ 올바른 사용 - 통합 인증 시스템 사용
import { requireAuth, requireRole, checkPageAccess } from '@/lib/auth/unified-auth'

// ❌ 잘못된 사용 - 레거시 인증 시스템 사용 금지
import { getAuthUser } from '@/lib/auth/server-auth' // 사용 금지!
import { useAuthCheck } from '@/hooks/useAuthCheck' // 레거시, 사용 금지!
```

##### 2. 데이터베이스 컬럼명 확인
```typescript
// ✅ 올바른 컬럼명 사용
.eq('user_id', user.id)  // employees 테이블은 user_id 사용
.eq('id', user.id)       // profiles 테이블은 id 사용

// ❌ 잘못된 컬럼명 - 실제 스키마와 불일치
.eq('profile_id', user.id)  // employees 테이블에 profile_id 컬럼 없음!
```

##### 3. 서버 컴포넌트 인증 패턴
```typescript
// ✅ 올바른 서버 컴포넌트 패턴
export default async function PageName() {
  // 1. 인증 먼저 체크
  const user = await requireAuth() // 또는 requireRole(['admin'])
  
  // 2. Admin 클라이언트로 데이터 페칭 (RLS 우회)
  const adminClient = createAdminClient()
  const data = await adminClient.from('table').select('*')
  
  // 3. 클라이언트 컴포넌트에 전달
  return <ClientComponent data={data} user={user} />
}

// ❌ 잘못된 패턴 - 중복 인증 체크
export default async function PageName() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser() // 중복!
  if (!user) redirect('/login') // 중복!
  // ... 이미 unified-auth가 처리함
}
```

##### 4. 권한 체크 위치
```typescript
// ✅ 올바른 위치 - 페이지 컴포넌트에서 체크
// app/(dashboard)/admin/page.tsx
export default async function AdminPage() {
  const user = await requireRole(['super_admin', 'admin'])
  // ...
}

// ❌ 잘못된 위치 - 미들웨어에서 권한 체크
// middleware.ts
if (user.role !== 'admin') { // 미들웨어는 인증만, 권한은 페이지에서!
  redirect('/dashboard')
}
```

##### 5. 데이터 페칭 전략
```typescript
// ✅ 올바른 전략 - Admin 클라이언트 사용
const adminClient = createAdminClient() // RLS 우회
const { data } = await adminClient.from('employees').select('*')

// ❌ 잘못된 전략 - 일반 클라이언트로 RLS 제한 받음
const supabase = await createClient()
const { data } = await supabase.from('employees').select('*') // RLS 제한!
```

#### 새 페이지 작성 시 (서버 컴포넌트)
```typescript
// page.tsx (서버 컴포넌트)
import { requireRole } from '@/lib/auth/unified-auth' // 통합 인증 사용!

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
2. **인증 시스템**: 새 페이지는 `/lib/auth/unified-auth` 사용 (server-auth 아님!)
3. **미들웨어**: 권한 체크 하지 않음 (인증만)
4. **서버 컴포넌트**: 가능한 모든 페이지를 서버 컴포넌트로
5. **RLS 정책**: profiles 테이블 정책 수정 시 순환 참조 주의

### ✅ 개발 체크리스트 (새 기능 추가 시)

#### 인증 관련 체크리스트
- [ ] `/lib/auth/unified-auth` 임포트 사용했는가?
- [ ] 레거시 인증 시스템 (`server-auth.ts`, `useAuthCheck`) 사용하지 않았는가?
- [ ] 서버 컴포넌트에서 `requireAuth()` 또는 `requireRole()` 호출했는가?
- [ ] 중복 인증 체크 없는가? (미들웨어와 페이지 둘 다 체크 X)
- [ ] 권한 체크는 페이지 컴포넌트에서만 하는가? (미들웨어 X)

#### 데이터베이스 체크리스트
- [ ] 실제 테이블 스키마 확인했는가? (추측 금지)
- [ ] employees 테이블은 `user_id` 컬럼 사용하는가?
- [ ] profiles 테이블은 `id` 컬럼 사용하는가?
- [ ] RLS 우회 필요시 `createAdminClient()` 사용했는가?
- [ ] 일반 클라이언트로 제한된 데이터 접근 시도하지 않았는가?

#### 성능 체크리스트
- [ ] React `cache` 또는 `unstable_cache` 활용했는가?
- [ ] 병렬 데이터 페칭 (`Promise.all`) 사용했는가?
- [ ] 불필요한 중복 쿼리 없는가?
- [ ] 클라이언트 컴포넌트 최소화했는가?

#### 에러 처리 체크리스트
- [ ] 비활성 사용자 체크했는가?
- [ ] 비활성 매장 체크했는가?
- [ ] 적절한 에러 메시지 제공하는가?
- [ ] 에러 시 적절한 리다이렉트 처리했는가?

### 🎯 모듈화 시스템 특징 (2025년 8월 10일)

#### Circuit Breaker 패턴
- **목적**: 장애 격리 및 자동 복구
- **상태**: CLOSED (정상) → OPEN (차단) → HALF_OPEN (테스트)
- **설정**: 에러율 50% 초과 시 30초간 차단

#### Retry Policy
- **목적**: 일시적 장애 자동 복구
- **전략**: Exponential Backoff with Jitter
- **설정**: 최대 3회 재시도, 지연 시간 점진적 증가

#### Fallback Mechanism
- **목적**: 장애 시 대체 로직 제공
- **구현**: 캐시된 데이터 또는 기본값 반환
- **체인**: 여러 Fallback 전략 순차 실행

#### Playwright E2E 테스트
- **설정**: 모든 페이지 클릭 시 1초 딜레이
- **커버리지**: 로그인, 판매, 상품 관리
- **브라우저**: Chrome, Firefox, Safari 지원
- **실행**: `npm run test:e2e`

### 📝 TODO (우선순위 순)

#### 완료된 작업 ✅
- [x] 대시보드 리다이렉션 문제 해결
- [x] Supabase 세션 관리 개선
- [x] 인증 시스템 통합
- [x] 서버 컴포넌트 마이그레이션 (주요 페이지)
  - [x] 간편판매 페이지
  - [x] 매출 요약 페이지
  - [x] 판매 내역 페이지
  - [x] 상품 관리 페이지
  - [x] 직원 관리 페이지 (2025년 8월 9일)
- [x] Server Actions 구현 (판매/상품/직원)
- [x] 캐싱 전략 구현 (unstable_cache)
- [x] 에러 바운더리 및 로딩 상태 개선
- [x] **의존성 주입 시스템 구현** (2025년 8월 10일)
- [x] **Circuit Breaker 패턴 구현** (2025년 8월 10일)
- [x] **Sales 서비스 모듈화** (2025년 8월 10일)
- [x] **Products 서비스 모듈화** (2025년 8월 10일)
- [x] **Playwright E2E 테스트 인프라 구축** (2025년 8월 10일)

#### 완료된 모듈화 작업 ✅
- [x] **Employees 서비스 모듈화** (2025년 8월 10일)
  - Repository 패턴 구현
  - Service 레이어 구현
  - Circuit Breaker 통합
  - 에러 클래스 구현
- [x] **트랜잭션 관리자 구현** (2025년 8월 10일)
  - Saga 패턴 구현
  - 분산 트랜잭션 관리
  - 보상 메커니즘
  - 트랜잭션 헬퍼 함수
- [x] **모듈별 Error Boundary 구현** (2025년 8월 10일)
  - ModuleErrorBoundary 기본 컴포넌트
  - SalesErrorBoundary
  - ProductsErrorBoundary
  - EmployeesErrorBoundary
  - 자동 복구 메커니즘
- [ ] 성능 최적화
  - [ ] 이미지 최적화 (next/image)
  - [ ] 번들 사이즈 감소
  - [ ] 데이터베이스 쿼리 최적화
- [ ] 프로덕션 배포 준비
  - [ ] 환경 변수 검증
  - [ ] 에러 모니터링 설정
  - [ ] 백업 전략 수립

#### 추후 작업
- [ ] 알림 시스템 구현
- [ ] PWA 기능 강화
- [ ] 실시간 데이터 업데이트 (Supabase Realtime)
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