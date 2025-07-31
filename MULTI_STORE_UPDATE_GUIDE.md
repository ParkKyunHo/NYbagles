# 다중 매장 지원 업데이트 가이드

## 구현된 기능 요약

### 1. ✅ 상품 표시 문제 해결
- 상품 추가 후 바로 표시되도록 수정
- 매장별 상품 연동 자동화 (트리거 기반)
- 상품 조회 로직 개선

### 2. ✅ 상품 관리에 매장 선택 기능 추가
- 관리자/슈퍼관리자: 전체 상품 카탈로그 관리
- 매니저: 자신의 매장 상품만 관리 (/products/store)
- 매장별 가격 설정 가능
- 매장별 재고 관리 가능

### 3. ✅ 판매 입력 시 매장 자동 선택
- 로그인한 직원의 매장 자동 감지
- 해당 매장의 상품만 표시
- 매장별 커스텀 가격 적용

### 4. ✅ 시스템 관리자 제어 기능
- 시스템 설정 페이지 추가 (/admin/system-settings)
- 다중 매장 기능 ON/OFF
- 매장 선택 필수 여부 설정
- 매니저 권한 제한 설정

### 5. ✅ 역할 기반 접근 제어 구현
- **슈퍼 관리자**: 모든 기능 접근 가능
- **관리자**: 모든 매장 관리 가능
- **매니저**: 자신의 매장만 관리 가능
- **직원**: 판매 입력만 가능

### 6. ✅ 사용자 승인 오류 수정
- 직원 승인 시 store_id 자동 할당
- 에러 처리 개선
- 프로필 생성 트리거 활용

## 데이터베이스 변경사항

### 1. profiles 테이블
```sql
-- store_id 컬럼 추가 (직원이 속한 매장)
ALTER TABLE profiles ADD COLUMN store_id UUID REFERENCES stores(id);
```

### 2. system_settings 테이블 (신규)
```sql
-- 시스템 전역 설정 관리
CREATE TABLE system_settings (
  id UUID PRIMARY KEY,
  key VARCHAR(255) UNIQUE,
  value JSONB,
  description TEXT
);
```

### 3. RLS 정책 업데이트
- products: 매장별 접근 권한 세분화
- store_products: 매니저는 자신의 매장만 관리
- system_settings: 슈퍼 관리자만 접근

## 마이그레이션 적용 방법

### 옵션 1: Supabase 대시보드에서 직접 실행
1. Supabase 대시보드 > SQL Editor 접속
2. 다음 파일들의 내용을 순서대로 실행:
   - `/supabase/migrations/20250131_fix_multi_store_support.sql`
   - `/supabase/migrations/20250131_add_store_products_rpc.sql`

### 옵션 2: 스크립트 실행
```bash
cd /home/albra/NYbalges/bagel-shop
npx tsx scripts/applyLatestMigrations.ts
```

## 주요 페이지 변경사항

### 1. 상품 관리 페이지 (/products)
- 매장 선택 드롭다운 추가
- 매니저는 읽기 전용 (편집은 /products/store에서)

### 2. 매장 상품 관리 (/products/store)
- 매니저 전용 페이지
- 매장별 가격/재고 설정
- 실시간 변경사항 저장

### 3. 판매 입력 (/sales)
- 자동 매장 감지
- 매장별 상품/가격 표시

### 4. 시스템 설정 (/admin/system-settings)
- 슈퍼 관리자 전용
- 전역 기능 ON/OFF

## 테스트 체크리스트

- [ ] 상품 추가 후 즉시 표시 확인
- [ ] 매니저 계정으로 자기 매장 상품만 관리 가능한지 확인
- [ ] 판매 입력 시 올바른 매장 상품만 표시되는지 확인
- [ ] 시스템 설정 변경이 즉시 적용되는지 확인
- [ ] 직원 승인 시 오류 없이 처리되는지 확인

## 알려진 이슈 및 해결 방법

### 1. "등록된 상품이 없습니다" 메시지
- 원인: store_products 레코드 누락
- 해결: 트리거가 자동 생성하도록 수정됨

### 2. 직원 승인 오류
- 원인: employees 테이블 구조 불일치
- 해결: 프로필 트리거 활용으로 우회

### 3. 매장 선택 안됨
- 원인: 프로필에 store_id 없음
- 해결: 마이그레이션으로 컬럼 추가

## 향후 개선 사항

1. 매장 간 재고 이동 기능
2. 본사 일괄 가격 정책 적용
3. 매장별 판매 분석 대시보드
4. 다중 매장 직원 지원