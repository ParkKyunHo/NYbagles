'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Edit, Trash2, Search, Settings, RefreshCw, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { CategoryManagementModal } from '@/components/products/CategoryManagementModal'
import { deleteProduct } from '@/lib/actions/products.actions'
import type { Product, Category, Store } from '@/lib/data/products.data'

interface ProductsClientProps {
  initialProducts: Product[]
  categories: Category[]
  stores: Store[]
  user: {
    id: string
    role: string
    storeId: string | null
    storeName: string
  }
  canManageProducts: boolean
  canManageCategories: boolean
  filters: {
    search: string
    category: string
    storeId: string
    status: string
  }
}

export default function ProductsClient({
  initialProducts,
  categories,
  stores,
  user,
  canManageProducts,
  canManageCategories,
  filters: initialFilters
}: ProductsClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  
  // 필터 상태
  const [searchTerm, setSearchTerm] = useState(initialFilters.search)
  const [selectedCategory, setSelectedCategory] = useState(initialFilters.category)
  const [selectedStore, setSelectedStore] = useState(initialFilters.storeId)
  
  // 필터 적용
  const handleFilter = () => {
    startTransition(() => {
      const params = new URLSearchParams()
      if (searchTerm) params.set('search', searchTerm)
      if (selectedCategory) params.set('category', selectedCategory)
      if (selectedStore && user.role !== 'manager') params.set('storeId', selectedStore)
      
      router.push(`/products?${params.toString()}`)
    })
  }
  
  // 새로고침
  const handleRefresh = () => {
    startTransition(() => {
      router.refresh()
    })
  }
  
  // 상품 삭제
  const handleDelete = async (productId: string) => {
    if (!confirm('이 상품을 삭제하시겠습니까? 모든 매장에서 삭제됩니다.')) {
      return
    }
    
    startTransition(async () => {
      const result = await deleteProduct(productId)
      
      if (result.success) {
        alert(result.message)
        router.refresh()
      } else {
        alert(result.error)
      }
    })
  }
  
  // 재고 상태에 따른 색상
  const getStockColor = (quantity: number) => {
    if (quantity === 0) return 'text-red-600 bg-red-50'
    if (quantity <= 10) return 'text-yellow-600 bg-yellow-50'
    return 'text-green-600 bg-green-50'
  }
  
  const getStockLabel = (quantity: number) => {
    if (quantity === 0) return '품절'
    if (quantity <= 10) return `재고 부족 (${quantity})`
    return `재고 ${quantity}`
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">상품 관리</h1>
          <p className="text-gray-900 mt-2">
            {user.role === 'manager' ? `${user.storeName} 상품 카탈로그` : '전체 상품 카탈로그를 관리합니다.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleRefresh}
            disabled={isPending}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isPending ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
          {canManageCategories && (
            <Button
              variant="outline"
              onClick={() => setShowCategoryModal(true)}
              className="flex items-center gap-2 text-gray-900 font-medium hover:text-black border-gray-400 hover:border-gray-600 hover:bg-gray-50"
            >
              <Settings className="h-4 w-4" />
              카테고리 관리
            </Button>
          )}
          {canManageProducts && (
            <Link href="/products/create">
              <Button className="flex items-center gap-2 bg-bagel-yellow hover:bg-yellow-600 text-black">
                <Plus className="h-4 w-4" />
                새 상품 추가
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="상품명으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFilter()}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow text-gray-900"
              />
            </div>
          </div>
          
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow text-gray-900 bg-white"
          >
            <option value="">모든 카테고리</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.name}>{cat.name}</option>
            ))}
          </select>
          
          {user.role !== 'manager' && (
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow text-gray-900 bg-white"
            >
              <option value="">모든 매장</option>
              {stores.map(store => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
          )}
          
          <Button
            onClick={handleFilter}
            disabled={isPending}
            className="bg-bagel-yellow hover:bg-yellow-600 text-black"
          >
            필터 적용
          </Button>
        </div>
      </div>

      {/* 상품 목록 */}
      {initialProducts.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Package className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-700 text-lg">등록된 상품이 없습니다.</p>
          {canManageProducts && (
            <Link href="/products/create">
              <Button className="mt-4 bg-bagel-yellow hover:bg-yellow-600 text-black">
                첫 상품 추가하기
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    상품명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    카테고리
                  </th>
                  {user.role !== 'manager' && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      매장
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    가격
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    재고
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {initialProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{product.name}</div>
                        {product.sku && (
                          <div className="text-xs text-gray-500">SKU: {product.sku}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                        {product.category}
                      </span>
                    </td>
                    {user.role !== 'manager' && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.stores?.name || '-'}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          ₩{product.base_price.toLocaleString()}
                        </div>
                        {product.sale_price && (
                          <div className="text-xs text-red-600">
                            ₩{product.sale_price.toLocaleString()}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStockColor(product.stock_quantity)}`}>
                        {getStockLabel(product.stock_quantity)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Link href={`/products/${product.id}/edit`}>
                          <button className="text-blue-600 hover:text-blue-900">
                            <Edit className="h-4 w-4" />
                          </button>
                        </Link>
                        {canManageProducts && (
                          <button
                            onClick={() => handleDelete(product.id)}
                            disabled={isPending}
                            className="text-red-600 hover:text-red-900 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 카테고리 관리 모달 */}
      {showCategoryModal && (
        <CategoryManagementModal
          isOpen={showCategoryModal}
          onClose={() => setShowCategoryModal(false)}
          onCategoryUpdate={() => {
            router.refresh()
          }}
        />
      )}
    </div>
  )
}