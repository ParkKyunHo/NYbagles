# 상품 관리 시스템 재설계 계획

## 목표
베이글샵의 실제 운영에 최적화된 심플하고 실용적인 시스템 구축

## 핵심 요구사항
1. **매장 매니저**
   - 베이글 클릭 → 판매 등록
   - 실시간 매출 확인
   - 시간대별 매출 추이
   - 마감 시 재고/판매량 확인

2. **시스템/관리자**
   - 각 매장에 메뉴 추가/수정
   - 전체 매장 통합 관리

## 새로운 데이터베이스 구조

### 1. products (심플하게 통합)
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID REFERENCES stores(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '베이글',
  price DECIMAL(10,2) NOT NULL,
  stock_quantity INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. sales (판매 기록)
```sql
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID REFERENCES stores(id),
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  sold_at TIMESTAMPTZ DEFAULT NOW(),
  sold_by UUID REFERENCES auth.users(id)
);
```

### 3. daily_closing (일일 마감)
```sql
CREATE TABLE daily_closing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID REFERENCES stores(id),
  closing_date DATE NOT NULL,
  product_id UUID REFERENCES products(id),
  opening_stock INTEGER NOT NULL,
  closing_stock INTEGER NOT NULL,
  total_sold INTEGER NOT NULL,
  total_revenue DECIMAL(10,2) NOT NULL,
  closed_by UUID REFERENCES auth.users(id),
  closed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, closing_date, product_id)
);
```

## 간소화된 RLS 정책

### products 테이블
```sql
-- 모든 사용자가 자신의 매장 상품 조회 가능
CREATE POLICY "view_store_products" ON products
  FOR SELECT USING (
    store_id IN (
      SELECT store_id FROM employees WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

-- 관리자만 상품 추가/수정
CREATE POLICY "manage_products" ON products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin', 'manager')
    )
  );
```

## UI/UX 개선안

### 1. 판매 화면 (매장용)
```
┌─────────────────────────────────┐
│  NY베이글 강남점 - 판매         │
├─────────────────────────────────┤
│ 🥯 플레인 베이글    ₩3,000     │
│    [재고: 50] [-][1][+] [판매]  │
│                                 │
│ 🥯 참깨 베이글      ₩3,500     │
│    [재고: 30] [-][1][+] [판매]  │
│                                 │
│ 오늘 매출: ₩520,000             │
└─────────────────────────────────┘
```

### 2. 매출 현황 (실시간)
```
┌─────────────────────────────────┐
│  오늘의 매출 현황               │
├─────────────────────────────────┤
│ 시간대별 매출                   │
│ [그래프: 9시~21시 매출 추이]    │
│                                 │
│ 베스트 셀러                     │
│ 1. 플레인 베이글 (120개)       │
│ 2. 참깨 베이글 (85개)          │
│                                 │
│ [일일 마감] 버튼                │
└─────────────────────────────────┘
```

## 구현 우선순위

### Phase 1 (즉시 구현)
1. 새로운 테이블 생성
2. 기존 데이터 마이그레이션
3. 심플한 RLS 정책 적용
4. 판매 등록 화면

### Phase 2 (1주일 내)
1. 실시간 매출 대시보드
2. 시간대별 매출 그래프
3. 일일 마감 기능

### Phase 3 (추후)
1. 재고 자동 알림
2. 매출 예측
3. 고급 분석 기능

## 예상 효과
- RLS 정책 10개 → 2개로 감소
- 테이블 3개 → 3개 (단순화)
- 권한 체계 단순화
- 사용자 경험 대폭 개선