'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientWithAuth } from '@/lib/supabase/client-auth'
import { Plus, Edit, Trash2, Search, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { CategoryManagementModal } from '@/components/products/CategoryManagementModal'

interface Product {
  id: string
  name: string
  description: string | null
  sku: string | null
  base_price: number
  sale_price: number | null
  category: string
  status: string
  stock_quantity: number
  store_id: string
  stores?: {
    id: string
    name: string
    code: string
  } | null
}

interface Store {
  id: string
  name: string
  code: string
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([])
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userStoreId, setUserStoreId] = useState<string | null>(null)
  const [stores, setStores] = useState<Store[]>([])
  const [selectedStore, setSelectedStore] = useState<string>('')
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const router = useRouter()
  const supabase = createClientWithAuth()

  useEffect(() => {
    checkAuth()
    fetchCategories()
    fetchStores()
  }, [])

  useEffect(() => {
    // 관리자나 슈퍼관리자는 매장 선택 없이도 전체 상품 보기 가능
    if (userRole === 'super_admin' || userRole === 'admin' || selectedStore) {
      fetchProducts()
    }
  }, [selectedStore, userRole])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/login')
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile && !profileError) {
      setUserRole(profile.role as string)
      
      // 일반 직원은 접근 불가
      if (!['super_admin', 'admin', 'manager'].includes(profile.role as string)) {
        router.push('/dashboard')
      }
      
      // 매니저인 경우 employees 테이블에서 store_id 가져오기
      if (profile.role === 'manager') {
        const { data: employee } = await supabase
          .from('employees')
          .select('store_id')
          .eq('user_id', user.id)
          .single()
        
        if (employee && employee.store_id) {
          setUserStoreId(employee.store_id)
          setSelectedStore(employee.store_id)
        }
      }
    }
  }

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('product_categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order')

    if (!error && data) {
      setCategories(data.map((cat: any) => ({ id: cat.id, name: cat.name })))
    }
  }

  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name')

      if (!error && data) {
        setStores(data)
      }
    } catch (error) {
      console.error('Error fetching stores:', error)
    }
  }

  const fetchProducts = async () => {
    if (!selectedStore && userRole === 'manager') {
      // 매니저는 매장 선택 필수
      return
    }

    setLoading(true)
    
    try {
      let query = supabase
        .from('products_v3')
        .select(`
          *,
          stores (
            id,
            name,
            code
          )
        `)

      // 매니저인 경우 자신의 매장 상품만 표시
      if (userRole === 'manager' && selectedStore) {
        query = query.eq('store_id', selectedStore)
      } else if (selectedStore) {
        // 관리자가 특정 매장을 선택한 경우
        query = query.eq('store_id', selectedStore)
      }
      // 관리자와 슈퍼관리자는 매장 선택하지 않으면 모든 상품 표시

      const { data, error } = await query
        .eq('status', 'active')  // 활성화된 상품만 표시
        .order('created_at', { ascending: false })
        .order('name', { ascending: true })

      if (error) throw error

      setProducts((data || []) as Product[])
    } catch (error: any) {
      console.error('Error fetching products:', error)
      // 더 상세한 오류 메시지
      if (error.code === 'PGRST301') {
        alert('인증 오류가 발생했습니다. 다시 로그인해주세요.')
        router.push('/login')
      } else {
        alert(`상품을 불러오는 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (productId: string) => {
    if (!confirm('이 상품을 삭제하시겠습니까? 모든 매장에서 삭제됩니다.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('products_v3')
        .update({ status: 'inactive' })
        .eq('id', productId as any)

      if (error) throw error

      fetchProducts()
    } catch (error) {
      console.error('Error deleting product:', error)
      alert('상품 삭제 중 오류가 발생했습니다.')
    }
  }

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = !selectedCategory || product.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const canManageProducts = userRole === 'super_admin' || userRole === 'admin'

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">상품 관리</h1>
          <p className="text-gray-900 mt-2">전체 상품 카탈로그를 관리합니다.</p>
        </div>
        {canManageProducts && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCategoryModal(true)}
              className="flex items-center gap-2 text-gray-900 font-medium hover:text-black border-gray-400 hover:border-gray-600 hover:bg-gray-50"
            >
              <Settings className="h-4 w-4" />
              카테고리 관리
            </Button>
            <Link href="/products/create">
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                새 상품 추가
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-900" />
              <input
                type="text"
                placeholder="상품명으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow"
              />
            </div>
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow text-gray-900 bg-white"
          >
            <option value="">모든 카테고리</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {/* 매장 선택 (관리자와 매니저용) */}
          {(['super_admin', 'admin'].includes(userRole || '') || (userRole === 'manager' && stores.length > 0)) && (
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow text-gray-900 bg-white"
              disabled={userRole === 'manager'}
            >
              <option value="">전체 상품 카탈로그</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* 상품 목록 */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bagel-yellow mx-auto"></div>
          <p className="mt-4 text-gray-900">로딩 중...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-900 mb-4">
            {selectedStore ? '선택한 매장에 등록된 상품이 없습니다.' : '등록된 상품이 없습니다.'}
          </p>
          {canManageProducts && !selectedStore && (
            <Link href="/products/create">
              <Button className="mx-auto">
                <Plus className="h-4 w-4 mr-2" />
                첫 상품 추가하기
              </Button>
            </Link>
          )}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-900">선택한 카테고리에 상품이 없습니다.</p>
          <Button
            variant="outline"
            onClick={() => setSelectedCategory('')}
            className="mt-4"
          >
            전체 상품 보기
          </Button>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                    상품명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                    카테고리
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                    기본 가격
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                    재고
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                    매장
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-900 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {product.name}
                        </div>
                        {product.description && (
                          <div className="text-sm text-gray-900">
                            {product.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                        {product.category || '베이글'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ₩{product.base_price.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.stock_quantity}개
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        product.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {product.status === 'active' ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">
                        {product.stores?.name || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {canManageProducts && (
                        <div className="flex justify-end gap-2">
                          <Link href={`/products/${product.id}/edit`}>
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(product.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 매장 상품 관리 링크 (매니저용) */}
      {userRole === 'manager' && (
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            매장의 상품 가격과 재고는{' '}
            <Link href="/products/store" className="font-medium underline">
              매장 상품 관리
            </Link>
            에서 설정할 수 있습니다.
          </p>
        </div>
      )}

      {/* 카테고리 관리 모달 */}
      <CategoryManagementModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onCategoryUpdate={fetchCategories}
      />
    </div>
  )
}