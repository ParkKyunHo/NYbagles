# CLAUDE.md

## 🎯 베이글샵 통합 관리 시스템 - 멀티테넌트 아키텍처

**프로덕션**: https://nybagles.vercel.app  
**GitHub**: https://github.com/ParkKyunHo/NYbagles.git  
**자동배포**: main 브랜치 푸시 시

## 🚨 필수 규칙

### 코드 작성 전 체크
1. **인증**: `/lib/auth/unified-auth` 사용 (❌ server-auth.ts, useAuthCheck 금지)
2. **데이터 페칭**: `createAdminClient()` 사용 (RLS 우회)
3. **테이블 컬럼**: employees는 `user_id`, profiles는 `id` 사용
4. **서버 컴포넌트 우선**: 클라이언트는 인터랙션만
5. **미들웨어**: 인증만 체크, 권한은 페이지에서

### 서버 컴포넌트 패턴
```typescript
// ✅ 올바른 패턴
export default async function PageName() {
  const user = await requireRole(['admin'])  // 1. 인증
  const adminClient = createAdminClient()    // 2. Admin 클라이언트
  const data = await adminClient.from('table').select('*')  // 3. 데이터 페칭
  const serialized = serializeRows(data)     // 4. 직렬화
  return <ClientComponent data={serialized} user={user} />
}
```

## 🏗️ 아키텍처

### 멀티테넌트 구조 (2025.01.11)
```typescript
// 핵심 테이블
- organizations (조직)
- memberships (역할 관리)  
- user_settings (active_org_id)
- audit_log (감사 로그)

// RLS 헬퍼 함수
public.is_member(org_id)
public.has_role(org_id, role)
public.is_admin(org_id)
public.current_org()
```

### 인증 API
```typescript
// 통합 인증 (/lib/auth/unified-auth)
await requireAuth()                    // 기본 인증
await requireRole(['admin'])           // 역할 체크
await checkPageAccess('/path')         // 페이지 권한
await checkOrganizationAccess(orgId)   // 조직 권한
await switchOrganization(newOrgId)     // 조직 전환

// AuthUser 타입
interface AuthUser {
  id, email, role
  organizationId?: string    // 새로운
  organizationName?: string  // 새로운
  storeId?: string          // Legacy
  isApproved: boolean       // 새로운
  isActive: boolean
}
```

### 권한 시스템
- `super_admin`: 전체 시스템
- `admin`: 전체 매장
- `manager`: 단일 매장
- `employee`: 판매/기본
- `part_time`: 파트타임

## 📁 핵심 파일 구조

### 데이터 레이어 (캐싱)
```
/lib/data/
├── sales.data.ts      // 5분 캐싱
├── products.data.ts   // 10분 캐싱
├── employees.data.ts  // 5분 캐싱
└── (캐싱: unstable_cache 사용)
```

### Server Actions
```
/lib/actions/
├── sales.actions.ts
├── products.actions.ts
├── employees.actions.ts
└── (revalidateTag/Path 사용)
```

### 유틸리티
```
/lib/utils/
├── serialization.ts   // 서버→클라이언트 데이터 직렬화
└── (BigInt→string, Date→ISO)
```

### 모듈 시스템
```
/lib/modules/
├── sales/    (service, repository, errors)
├── products/ (service, repository, errors)
└── employees/(service, repository, errors)
```

## 🔥 자주 발생하는 문제 해결

### 1. RLS 무한 재귀 (500 에러)
```sql
-- 문제: profiles ↔ employees 순환 참조
-- 해결: Admin 클라이언트 사용
const adminClient = createAdminClient()
```

### 2. 대시보드 리다이렉트 문제
```typescript
// 문제: 잘못된 인증 시스템 사용
// 해결: unified-auth 사용
import { requireAuth } from '@/lib/auth/unified-auth'
```

### 3. 서버 컴포넌트 렌더 에러
```typescript
// 문제: 직렬화 안된 데이터 전달
// 해결: serialization 헬퍼 사용
import { serializeRows } from '@/lib/utils/serialization'
const serialized = serializeRows(data)
```

### 4. 캐시 업데이트 안됨
```typescript
// Server Action에서 캐시 무효화
revalidateTag('employees')
revalidatePath('/dashboard/employees')
```

## ✅ 개발 체크리스트

### 새 페이지 작성 시
- [ ] `/lib/auth/unified-auth` 사용
- [ ] 서버 컴포넌트로 작성
- [ ] `createAdminClient()` 사용
- [ ] 데이터 직렬화 적용
- [ ] 에러 바운더리 추가
- [ ] 병렬 페칭 사용 (`Promise.all`)
- [ ] 캐싱 전략 적용

### 조직 확인 필수
```typescript
if (!user.isApproved) redirect('/pending-approval')
if (!user.organizationId) redirect('/select-organization')
```

## 📊 완료된 서버 컴포넌트 페이지

- ✅ `/dashboard/quick-sale` - 간편 판매
- ✅ `/sales/summary` - 매출 요약
- ✅ `/sales/history` - 판매 내역
- ✅ `/products` - 상품 관리
- ✅ `/dashboard/employees` - 직원 관리

## 🎯 특수 기능

### Circuit Breaker 패턴
- 에러율 50% 초과 시 30초 차단
- 자동 복구 메커니즘

### Retry Policy
- Exponential Backoff with Jitter
- 최대 3회 재시도

### E2E 테스트
- Playwright 사용
- `npm run test:e2e`

## 📝 미완료 작업

- [ ] `/select-organization` 페이지 구현
- [ ] `/pending-approval` 페이지 구현
- [ ] 직원 상세 페이지 (`/dashboard/employees/[id]`)
- [ ] 급여 관리 페이지 (`/dashboard/salary`)
- [ ] 실시간 업데이트 (Supabase Realtime)
- [ ] PWA 기능 강화

## 💡 Quick Tips

1. **서버 컴포넌트 예시**: `/app/(dashboard)/dashboard/quick-sale/`
2. **에러 시 확인**: 데이터 직렬화, 조직 설정, RLS 정책
3. **성능**: 병렬 페칭, 캐싱, 클라이언트 컴포넌트 최소화
4. **디버깅**: digest 코드 확인, 개발 환경에서 상세 에러 표시

---
**언어**: 한글 답변 | **시간**: 대한민국 시간 | **코드 수정**: 단계별 진행