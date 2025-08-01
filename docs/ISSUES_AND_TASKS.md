# NYbalges 베이글샵 관리 시스템 - 문제점 및 작업 계획

## 📅 문서 작성일: 2025-08-01

## 🔍 현황 요약

2025년 8월 1일 배포 준비 과정에서 확인된 10개의 주요 문제점을 정리하고, 체계적인 해결 방안을 수립한 문서입니다.

## 🚨 문제점 목록 (우선순위별)

### Critical - 긴급 기능 오류

#### 1. 상품 승인 페이지 오류
- **현상**: `/products/approvals` 페이지 접근 시 오류 발생
- **파일**: `/app/(dashboard)/products/approvals/page.tsx`
- **예상 원인**: 
  - Supabase 쿼리에서 관계 설정 문제
  - `product_changes` 테이블과 `products_v3` 조인 오류
- **해결 방안**:
  ```typescript
  // Line 106-119의 쿼리 수정 필요
  .select(`
    *,
    product:products_v3!inner(
      id,
      sku,
      name,
      store_id,
      store:stores!inner(name)
    )
  `)
  ```

#### 2. 재고 차감 미작동
- **현상**: 판매 시 `stock_quantity`가 감소하지 않음
- **관련 파일**: 
  - `/supabase/migrations/20250731_implement_product_approval_system.sql`
  - `/app/(dashboard)/sales/simple/page.tsx`
- **예상 원인**: `update_product_stock()` 트리거 미작동
- **해결 방안**:
  ```sql
  -- 트리거 재생성 및 검증
  CREATE OR REPLACE TRIGGER update_product_stock_on_sale
    AFTER INSERT ON sales_items
    FOR EACH ROW
    EXECUTE FUNCTION update_product_stock();
  ```

#### 4. 상품 관리 중복 키 오류
- **현상**: `duplicate key value violates unique constraint 'store_products_store_id_product_id_key'`
- **파일**: `/app/(dashboard)/products/v2/page.tsx`
- **원인**: 레거시 `store_products` 테이블과 신규 `products_v3` 충돌
- **해결 방안**:
  - `store_products` 테이블 제거 또는 비활성화
  - 관련 제약 조건 정리

#### 6. 회원가입 승인 오류 및 "verified" 상태 제거
- **현상**: 회원가입 승인 처리 시 오류
- **파일**: `/app/api/admin/signup-requests/[id]/approve/route.ts`
- **추가 요구**: "verified" 상태 제거
- **해결 방안**:
  ```typescript
  // Line 114: status 업데이트 시 'verified' 제거
  status: 'approved', // 'verified' 상태 사용 안함
  ```

### High - 권한 관리 개선

#### 3, 8, 9. 매장 선택 기능 추가 (admin/super_admin)
- **대상 페이지**:
  - 일일 마감: `/daily-closing`
  - 간편 판매: `/sales/simple`
  - 간편 상품관리: `/products/v2`
- **구현 방안**:
  ```typescript
  // 공통 StoreSelector 컴포넌트 생성
  interface StoreSelectorProps {
    selectedStoreId: string | null;
    onStoreChange: (storeId: string) => void;
    userRole: string;
  }
  
  // 각 페이지에 조건부 렌더링
  {(userRole === 'super_admin' || userRole === 'admin') && (
    <StoreSelector 
      selectedStoreId={storeId}
      onStoreChange={handleStoreChange}
      userRole={userRole}
    />
  )}
  ```

#### 5. 상품-매장 연결 표시
- **현상**: 판매 입력 시 어느 매장 상품인지 구분 불가
- **해결 방안**:
  - 상품명 옆에 매장명 표시
  - 매장별 상품 그룹핑
  - 필터링 옵션 추가

### Medium - UI/UX 개선

#### 7. 폰트 가시성 개선
- **현상**: 연한 회색 폰트로 가독성 저하
- **파일**: `/app/globals.css`, 각 컴포넌트 스타일
- **해결 방안**:
  ```css
  /* text-gray-500 → text-gray-700 */
  /* text-gray-400 → text-gray-600 */
  .text-muted {
    color: rgb(55 65 81); /* gray-700 */
  }
  ```

### Low - 시스템 구조

#### 10. 이중 시스템 유지
- **목적**: 두 시스템 비교 테스트
- **전략**:
  - v2 시스템과 v3 시스템 병행 운영
  - 성능 및 사용성 메트릭 수집
  - 2-4주 테스트 후 최종 결정

## 📋 작업 실행 계획

### Sprint 1 (2025-08-04 ~ 2025-08-08)
1. **Day 1-2**: Critical 오류 수정
   - [ ] 상품 승인 페이지 쿼리 수정
   - [ ] 재고 차감 트리거 검증 및 수정
   - [ ] 중복 키 오류 해결
   - [ ] 회원가입 승인 프로세스 수정

2. **Day 3-4**: 권한 관리 구현
   - [ ] StoreSelector 컴포넌트 개발
   - [ ] 3개 페이지에 매장 선택 기능 추가
   - [ ] 상품-매장 연결 표시 개선

3. **Day 5**: UI/UX 및 최종 테스트
   - [ ] 전역 폰트 색상 업데이트
   - [ ] 통합 테스트 수행
   - [ ] 배포 준비

### 테스트 체크리스트
- [ ] 모든 Critical 오류 해결 확인
- [ ] 권한별 기능 테스트 (super_admin, admin, manager, employee)
- [ ] 매장 선택 기능 동작 확인
- [ ] UI 가독성 개선 확인
- [ ] 데이터 정합성 검증

## 🔧 기술 스택 참고
- Next.js 14.1.0 (App Router)
- Supabase (PostgreSQL + Auth)
- TypeScript
- Tailwind CSS

## 📌 주의사항
1. 모든 변경사항은 로컬에서 충분히 테스트 후 배포
2. 데이터베이스 마이그레이션은 백업 후 실행
3. 두 시스템(v2, v3) 데이터 동기화 주의
4. 사용자 피드백 지속적 수집

## 🔄 업데이트 기록
- 2025-08-01: 초기 문서 작성
- 다음 업데이트 예정: Sprint 1 완료 후