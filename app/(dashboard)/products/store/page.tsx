'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Save, RotateCcw, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface StoreProduct {
  product_id: string
  product_name: string
  category_name: string
  sku: string | null
  unit: string
  default_price: number
  store_price: number | null
  is_available: boolean
  stock_quantity: number
}

interface Store {
  id: string
  name: string
  code: string
}

export default function StoreProductsPage() {
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [originalProducts, setOriginalProducts] = useState<StoreProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [store, setStore] = useState<Store | null>(null)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [categories, setCategories] = useState<Array<{ name: string }>>([])
  const [hasChanges, setHasChanges] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkAuthAndLoadData()
  }, [])

  useEffect(() => {
    // 변경사항 감지
    const changed = JSON.stringify(products) !== JSON.stringify(originalProducts)
    setHasChanges(changed)
  }, [products, originalProducts])

  const checkAuthAndLoadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/login')
      return
    }

    // 사용자 정보 및 매장 정보 가져오기
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['super_admin', 'admin', 'manager'].includes(profile.role)) {
      router.push('/dashboard')
      return
    }

    // 매니저인 경우 자신의 매장 정보 가져오기
    if (profile.role === 'manager') {
      const { data: employee } = await supabase
        .from('employees')
        .select(`
          store_id,
          stores (
            id,
            name,
            code
          )
        `)
        .eq('user_id', user.id)
        .single()

      if (employee?.stores) {
        setStore(employee.stores as any)
        fetchStoreProducts((employee.stores as any).id)
      }
    } else {
      // 관리자는 첫 번째 매장 선택 (실제로는 매장 선택 UI 필요)
      const { data: stores } = await supabase
        .from('stores')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .single()

      if (stores) {
        setStore(stores)
        fetchStoreProducts(stores.id)
      }
    }
  }

  const fetchStoreProducts = async (storeId: string) => {
    setLoading(true)
    
    try {
      const { data, error } = await supabase
        .rpc('get_store_products', { p_store_id: storeId })

      if (error) throw error

      const productsData = data || []
      setProducts(productsData)
      setOriginalProducts(JSON.parse(JSON.stringify(productsData)))

      // 카테고리 추출
      const uniqueCategories = Array.from(new Set(productsData.map((p: any) => p.category_name)))
        .filter(Boolean)
        .map((name) => ({ name: String(name) }))
      setCategories(uniqueCategories)
    } catch (error) {
      console.error('Error fetching store products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleProductChange = (productId: string, field: string, value: any) => {
    setProducts(prev => prev.map(product => {
      if (product.product_id === productId) {
        return { ...product, [field]: value }
      }
      return product
    }))
  }

  const handleSave = async () => {
    if (!store || !hasChanges) return

    setSaving(true)
    
    try {
      // 변경된 상품만 필터링
      const changedProducts = products.filter((product, index) => {
        const original = originalProducts[index]
        return JSON.stringify(product) !== JSON.stringify(original)
      })

      // 각 변경된 상품에 대해 upsert 수행
      for (const product of changedProducts) {
        const { error } = await supabase
          .from('store_products')
          .upsert({
            store_id: store.id,
            product_id: product.product_id,
            custom_price: product.store_price,
            is_available: product.is_available,
            stock_quantity: product.stock_quantity
          }, {
            onConflict: 'store_id,product_id'
          })

        if (error) throw error
      }

      // 성공 후 데이터 다시 로드
      fetchStoreProducts(store.id)
      alert('매장 상품 정보가 저장되었습니다.')
    } catch (error) {
      console.error('Error saving store products:', error)
      alert('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (hasChanges && confirm('변경사항을 모두 취소하시겠습니까?')) {
      setProducts(JSON.parse(JSON.stringify(originalProducts)))
    }
  }

  const filteredProducts = selectedCategory
    ? products.filter(p => p.category_name === selectedCategory)
    : products

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bagel-yellow mx-auto"></div>
          <p className="mt-4 text-gray-800">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">매장 상품 관리</h1>
        <p className="text-gray-800 mt-2">
          {store ? `${store.name} (${store.code})` : '매장'}의 상품 가격과 재고를 관리합니다.
        </p>
      </div>

      {/* 안내 메시지 */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-md p-4 flex items-start">
        <AlertCircle className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">매장별 가격 설정 안내</p>
          <ul className="list-disc list-inside space-y-1">
            <li>매장 가격을 입력하지 않으면 기본 가격이 적용됩니다.</li>
            <li>판매 여부를 해제하면 해당 상품은 매장에서 판매되지 않습니다.</li>
            <li>변경사항은 저장 버튼을 클릭해야 적용됩니다.</li>
          </ul>
        </div>
      </div>

      {/* 필터 및 액션 버튼 */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex justify-between items-center">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow"
          >
            <option value="">모든 카테고리</option>
            {categories.map((category) => (
              <option key={category.name} value={category.name}>
                {category.name}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={handleReset}
              disabled={!hasChanges || saving}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              초기화
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {saving ? '저장 중...' : '저장'}
            </Button>
          </div>
        </div>
      </div>

      {/* 상품 목록 */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  기본 가격
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  매장 가격
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  재고
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                  판매 여부
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.map((product) => (
                <tr key={product.product_id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {product.product_name}
                      </div>
                      {product.sku && (
                        <div className="text-sm text-gray-700">
                          SKU: {product.sku}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                      {product.category_name}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ₩{product.default_price.toLocaleString()}/{product.unit}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-700 text-sm">
                        ₩
                      </span>
                      <input
                        type="number"
                        value={product.store_price || ''}
                        onChange={(e) => handleProductChange(
                          product.product_id,
                          'store_price',
                          e.target.value ? parseFloat(e.target.value) : null
                        )}
                        className="w-32 pl-8 pr-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-bagel-yellow"
                        placeholder={product.default_price.toString()}
                        step="100"
                        min="0"
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="number"
                      value={product.stock_quantity}
                      onChange={(e) => handleProductChange(
                        product.product_id,
                        'stock_quantity',
                        parseInt(e.target.value) || 0
                      )}
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-bagel-yellow"
                      min="0"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <input
                      type="checkbox"
                      checked={product.is_available}
                      onChange={(e) => handleProductChange(
                        product.product_id,
                        'is_available',
                        e.target.checked
                      )}
                      className="h-4 w-4 text-bagel-yellow focus:ring-bagel-yellow border-gray-300 rounded"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}