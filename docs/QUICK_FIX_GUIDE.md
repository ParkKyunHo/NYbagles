# NYbalges 베이글샵 - 빠른 수정 가이드

## 🚨 Critical 오류 즉시 수정 방법

### 1. 상품 승인 페이지 오류 수정
```typescript
// /app/(dashboard)/products/approvals/page.tsx
// Line 106-119 수정

// 변경 전:
.select(`
  *,
  product:products_v3(
    id,
    sku,
    name,
    store_id,
    store:stores(name)
  ),
  requester:requested_by(
    email,
    profiles:profiles(full_name)
  )
`)

// 변경 후:
.select(`
  *,
  product:product_id(
    id,
    sku,
    name,
    store_id,
    stores!products_v3_store_id_fkey(name)
  ),
  profiles!product_changes_requested_by_fkey(
    email,
    full_name
  )
`)
```

### 2. 재고 차감 트리거 수정
```sql
-- 즉시 실행할 SQL
CREATE OR REPLACE FUNCTION update_product_stock() 
RETURNS TRIGGER AS $$
BEGIN
  -- 재고 감소
  UPDATE products_v3 
  SET stock_quantity = stock_quantity - NEW.quantity,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.product_id
    AND stock_quantity >= NEW.quantity;
  
  -- 재고 부족 체크
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient stock for product %', NEW.product_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 재생성
DROP TRIGGER IF EXISTS update_product_stock_on_sale ON sales_items;
CREATE TRIGGER update_product_stock_on_sale
  AFTER INSERT ON sales_items
  FOR EACH ROW
  EXECUTE FUNCTION update_product_stock();
```

### 3. 중복 키 오류 해결
```sql
-- store_products 테이블 관련 제약 조건 제거
ALTER TABLE store_products DROP CONSTRAINT IF EXISTS store_products_store_id_product_id_key;

-- 또는 테이블 자체를 비활성화
ALTER TABLE store_products RENAME TO store_products_legacy;
```

### 4. 회원가입 승인 수정
```typescript
// /app/api/admin/signup-requests/[id]/approve/route.ts
// Line 109-117 수정

const { error: updateError } = await supabase
  .from('employee_signup_requests')
  .update({
    approved: true,
    approved_by: user.id,
    approved_at: new Date().toISOString(),
    status: 'approved' // 'verified' 제거
  })
  .eq('id', params.id)
```

## 🔧 공통 컴포넌트 - StoreSelector

```typescript
// /components/ui/store-selector.tsx
import { useEffect, useState } from 'react'
import { createClientWithAuth } from '@/lib/supabase/client-auth'

interface StoreSelectorProps {
  selectedStoreId: string | null
  onStoreChange: (storeId: string) => void
  userRole: string
}

export function StoreSelector({ selectedStoreId, onStoreChange, userRole }: StoreSelectorProps) {
  const [stores, setStores] = useState<{ id: string; name: string }[]>([])
  const supabase = createClientWithAuth()

  useEffect(() => {
    if (userRole === 'super_admin' || userRole === 'admin') {
      fetchStores()
    }
  }, [userRole])

  const fetchStores = async () => {
    const { data } = await supabase
      .from('stores')
      .select('id, name')
      .order('name')
    
    if (data) {
      setStores(data)
    }
  }

  if (userRole !== 'super_admin' && userRole !== 'admin') {
    return null
  }

  return (
    <select
      value={selectedStoreId || ''}
      onChange={(e) => onStoreChange(e.target.value)}
      className="px-3 py-2 border rounded-md"
    >
      <option value="">매장 선택</option>
      {stores.map(store => (
        <option key={store.id} value={store.id}>
          {store.name}
        </option>
      ))}
    </select>
  )
}
```

## 🎨 폰트 색상 일괄 수정

```bash
# 프로젝트 전체에서 연한 색상 찾아 수정
find . -name "*.tsx" -o -name "*.ts" | xargs sed -i 's/text-gray-400/text-gray-600/g'
find . -name "*.tsx" -o -name "*.ts" | xargs sed -i 's/text-gray-500/text-gray-700/g'

# globals.css에 추가
echo "
/* 가독성 개선 */
.text-muted {
  @apply text-gray-700;
}

.text-muted-foreground {
  @apply text-gray-600;
}
" >> app/globals.css
```

## ✅ 테스트 명령어

```bash
# 1. TypeScript 컴파일 확인
npm run build

# 2. 개발 서버 실행
npm run dev

# 3. Supabase 마이그레이션 확인
npx supabase db diff
```

## 📱 긴급 연락처
- 개발팀 리드: [연락처]
- Supabase 지원: https://supabase.com/support
- 프로젝트 GitHub: [저장소 URL]