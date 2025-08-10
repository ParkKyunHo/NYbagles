import { Suspense } from 'react'
import { requireRole } from '@/lib/auth/unified-auth'
import { getProducts, getCategories, getStores } from '@/lib/data/products.data'
import ProductsClient from './ProductsClient'

// 로딩 컴포넌트는 이미 loading.tsx에 정의됨

interface PageProps {
  searchParams: {
    search?: string
    category?: string
    storeId?: string
    status?: string
  }
}

export default async function ProductsPage({ searchParams }: PageProps) {
  // 권한 체크 및 사용자 정보 가져오기
  const user = await requireRole(['super_admin', 'admin', 'manager'])
  
  // 매니저는 자신의 매장만 볼 수 있음
  const storeId = user.role === 'manager' 
    ? user.storeId 
    : searchParams.storeId || null
  
  // 병렬 데이터 페칭
  const [products, categories, stores] = await Promise.all([
    getProducts({
      storeId,
      category: searchParams.category,
      searchTerm: searchParams.search,
      status: searchParams.status || 'active'
    }),
    getCategories(),
    getStores()
  ])
  
  // 권한별 기능 제어
  const canManageProducts = user.role === 'super_admin' || user.role === 'admin'
  const canManageCategories = user.role === 'super_admin' || user.role === 'admin'
  
  return (
    <Suspense fallback={null}>
      <ProductsClient
        initialProducts={products}
        categories={categories}
        stores={stores}
        user={{
          id: user.id,
          role: user.role,
          storeId: user.storeId || null,
          storeName: user.storeName || ''
        }}
        canManageProducts={canManageProducts}
        canManageCategories={canManageCategories}
        filters={{
          search: searchParams.search || '',
          category: searchParams.category || '',
          storeId: storeId || '',
          status: searchParams.status || 'active'
        }}
      />
    </Suspense>
  )
}