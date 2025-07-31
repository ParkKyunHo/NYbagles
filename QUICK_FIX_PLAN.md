# 상품 관리 긴급 조치 계획

## 🚨 즉시 적용 가능한 수정사항

### 1. RLS 정책 완전 초기화 (30분)
```sql
-- 모든 기존 정책 제거
DROP POLICY IF EXISTS ALL ON products;
DROP POLICY IF EXISTS ALL ON product_categories;
DROP POLICY IF EXISTS ALL ON store_products;

-- 단순한 2개 정책만 생성
CREATE POLICY "anyone_can_read" ON products FOR SELECT USING (true);
CREATE POLICY "managers_can_write" ON products FOR ALL USING (
  auth.uid() IN (SELECT user_id FROM profiles WHERE role != 'employee')
);
```

### 2. 임시 판매 화면 생성 (2시간)
- /dashboard/quick-sale 페이지 생성
- 매장의 베이글 목록만 표시
- 클릭 시 바로 판매 등록
- 복잡한 기능 모두 제거

### 3. 데이터 정리 (1시간)
- store_products 테이블 데이터를 products로 통합
- 불필요한 카테고리 제거
- 중복 데이터 정리

## 🎯 새 시스템 구축 계획 (3-5일)

### Day 1: 데이터베이스 재설계
- 3개 심플한 테이블만 사용
- 명확한 RLS 정책
- 마이그레이션 스크립트

### Day 2: 핵심 판매 기능
- 베이글 판매 화면
- 실시간 매출 표시
- 재고 자동 차감

### Day 3: 매출 분석
- 시간대별 매출 그래프
- 베스트셀러 표시
- 일일 마감 기능

### Day 4: 관리자 기능
- 메뉴 추가/수정
- 가격 조정
- 재고 관리

### Day 5: 테스트 및 배포
- 전체 기능 테스트
- 데이터 마이그레이션
- 안전한 배포

## 선택지
1. **긴급 조치만** → 오늘 바로 적용 가능
2. **새 시스템 구축** → 근본적 해결 (권장)