'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { salesService } from '@/lib/services/sales.service'
import { ShoppingCart, Plus, Minus, X, CreditCard, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Product, CreateSaleItem, PaymentMethod } from '@/types/sales'

interface CartItem extends CreateSaleItem {
  product: Product
}

interface Store {
  id: string
  name: string
  code: string
}

export default function SalesPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [store, setStore] = useState<Store | null>(null)
  const [stores, setStores] = useState<Store[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState<string>('')
  const [userRole, setUserRole] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkAuthAndLoadData()
  }, [])

  const checkAuthAndLoadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/login')
      return
    }

    // 사용자 프로필 조회
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, store_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      alert('사용자 정보를 찾을 수 없습니다.')
      router.push('/dashboard')
      return
    }

    setUserRole(profile.role)

    // 관리자/슈퍼관리자인 경우 모든 매장 목록 조회
    if (profile.role === 'super_admin' || profile.role === 'admin') {
      const { data: allStores } = await supabase
        .from('stores')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name')

      if (allStores) {
        setStores(allStores)
        // 첫 번째 매장 자동 선택
        if (allStores.length > 0) {
          setSelectedStoreId(allStores[0].id)
          setStore(allStores[0])
          await fetchProducts(allStores[0].id)
        }
      }
    } else {
      // 일반 직원/매니저는 자신의 매장 정보만 조회
      const { data: employeeRecord } = await supabase
        .from('employees')
        .select('store_id')
        .eq('user_id', user.id)
        .single()

      if (!employeeRecord || !employeeRecord.store_id) {
        // profiles에서 store_id 확인
        if (profile.store_id) {
          const { data: storeData } = await supabase
            .from('stores')
            .select('id, name, code')
            .eq('id', profile.store_id)
            .single()

          if (storeData) {
            setStore(storeData)
            setSelectedStoreId(storeData.id)
            await fetchProducts(storeData.id)
          }
        } else {
          alert('매장이 할당되지 않았습니다. 관리자에게 문의하세요.')
          router.push('/dashboard')
        }
      } else {
        const { data: storeData } = await supabase
          .from('stores')
          .select('id, name, code')
          .eq('id', employeeRecord.store_id)
          .single()

        if (storeData) {
          setStore(storeData)
          setSelectedStoreId(storeData.id)
          await fetchProducts(storeData.id)
        }
      }
    }
  }

  const fetchProducts = async (storeId: string) => {
    setLoading(true)
    
    try {
      // 매장의 판매 가능한 상품 조회
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_categories (
            id,
            name
          ),
          store_products!inner (
            store_id,
            custom_price,
            is_available,
            stock_quantity
          )
        `)
        .eq('is_active', true)
        .eq('store_products.store_id', storeId)
        .eq('store_products.is_available', true)
        .order('product_categories.display_order')
        .order('display_order')

      if (error) throw error

      // 매장 가격 적용
      const productsWithStorePrice = data?.map(product => ({
        ...product,
        price: product.store_products[0]?.custom_price || product.price,
        stock_quantity: product.store_products[0]?.stock_quantity || 0
      })) || []

      setProducts(productsWithStorePrice)

      // 카테고리 추출
      const uniqueCategories = Array.from(
        new Set(productsWithStorePrice.map(p => JSON.stringify(p.product_categories)))
      ).map(str => JSON.parse(str)).filter(Boolean)
      
      setCategories(uniqueCategories)
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.product_id === product.id)
    
    if (existingItem) {
      updateQuantity(product.id, existingItem.quantity + 1)
    } else {
      setCart([...cart, {
        product_id: product.id,
        quantity: 1,
        unit_price: product.price,
        discount_amount: 0,
        product
      }])
    }
  }

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId)
      return
    }

    setCart(cart.map(item => 
      item.product_id === productId
        ? { ...item, quantity }
        : item
    ))
  }

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product_id !== productId))
  }

  const calculateTotal = () => {
    return cart.reduce((total, item) => 
      total + (item.quantity * item.unit_price - (item.discount_amount || 0)), 0
    )
  }

  const handleSubmit = async () => {
    if (cart.length === 0) {
      alert('장바구니에 상품을 추가해주세요.')
      return
    }

    setSubmitting(true)

    try {
      const saleData = {
        items: cart.map(({ product, ...item }) => item),
        payment_method: paymentMethod,
        notes
      }

      const result = await salesService.createSale(saleData)

      if (result.success) {
        alert('판매가 기록되었습니다.')
        // 초기화
        setCart([])
        setNotes('')
        setPaymentMethod('cash')
      } else {
        alert(result.error || '판매 기록 실패')
      }
    } catch (error) {
      console.error('Error creating sale:', error)
      alert('판매 기록 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredProducts = selectedCategory
    ? products.filter(p => p.product_categories?.id === selectedCategory)
    : products

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bagel-yellow mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">판매 관리</h1>
            <p className="text-gray-600 mt-2">{store?.name} - 판매 입력</p>
          </div>
          <div className="flex gap-2">
            {/* 관리자/슈퍼관리자용 매장 선택 */}
            {(userRole === 'super_admin' || userRole === 'admin') && stores.length > 0 && (
              <select
                value={selectedStoreId}
                onChange={async (e) => {
                  const storeId = e.target.value
                  setSelectedStoreId(storeId)
                  const selectedStore = stores.find(s => s.id === storeId)
                  if (selectedStore) {
                    setStore(selectedStore)
                    setCart([]) // 장바구니 초기화
                    await fetchProducts(storeId)
                  }
                }}
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow text-gray-900 bg-white"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            )}
            <Button
              onClick={() => router.push('/sales/history')}
              variant="secondary"
            >
              판매 내역
            </Button>
            <Button
              onClick={() => router.push('/sales/summary')}
              variant="secondary"
            >
              매출 요약
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 상품 목록 */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow">
            {/* 카테고리 필터 */}
            <div className="p-4 border-b">
              <div className="flex gap-2 overflow-x-auto">
                <button
                  onClick={() => setSelectedCategory('')}
                  className={`px-4 py-2 rounded-md whitespace-nowrap transition-colors ${
                    !selectedCategory 
                      ? 'bg-bagel-yellow text-black' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  전체
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`px-4 py-2 rounded-md whitespace-nowrap transition-colors ${
                      selectedCategory === category.id
                        ? 'bg-bagel-yellow text-black' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 상품 그리드 */}
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4 hover:border-bagel-yellow hover:bg-yellow-50 transition-all"
                  >
                    <h3 className="font-medium text-gray-900 mb-2">
                      {product.name}
                    </h3>
                    <p className="text-bagel-yellow font-bold">
                      ₩{product.price.toLocaleString()}
                    </p>
                    {product.stock_quantity !== undefined && product.stock_quantity < 10 && (
                      <p className="text-xs text-red-600 mt-1">
                        재고: {product.stock_quantity}개
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 장바구니 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6 sticky top-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <ShoppingCart className="h-5 w-5 mr-2" />
                장바구니
              </h2>
              <span className="text-sm text-gray-700">
                {cart.length}개 상품
              </span>
            </div>

            {/* 장바구니 아이템 */}
            <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
              {cart.length === 0 ? (
                <p className="text-center text-gray-700 py-8">
                  상품을 선택해주세요
                </p>
              ) : (
                cart.map((item) => (
                  <div key={item.product_id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-gray-900 flex-1">
                        {item.product.name}
                      </h4>
                      <button
                        onClick={() => removeFromCart(item.product_id)}
                        className="text-gray-600 hover:text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                          className="p-1 bg-white rounded border hover:bg-gray-100"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                          className="p-1 bg-white rounded border hover:bg-gray-100"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="font-medium">
                        ₩{(item.quantity * item.unit_price).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 결제 방법 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                결제 방법
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'cash', label: '현금', icon: DollarSign },
                  { value: 'card', label: '카드', icon: CreditCard },
                  { value: 'transfer', label: '계좌이체', icon: DollarSign },
                  { value: 'mobile', label: '모바일', icon: CreditCard }
                ].map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setPaymentMethod(value as PaymentMethod)}
                    className={`p-2 rounded-md border-2 transition-all flex items-center justify-center gap-1 ${
                      paymentMethod === value
                        ? 'border-bagel-yellow bg-yellow-50 text-gray-900'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 메모 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                메모 (선택)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow"
                placeholder="특이사항을 입력하세요"
              />
            </div>

            {/* 합계 및 결제 버튼 */}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-4">
                <span className="text-lg font-bold text-gray-900">합계</span>
                <span className="text-2xl font-bold text-bagel-yellow">
                  ₩{calculateTotal().toLocaleString()}
                </span>
              </div>
              <Button
                onClick={handleSubmit}
                disabled={cart.length === 0 || submitting}
                className="w-full bg-bagel-yellow hover:bg-yellow-600 text-black"
              >
                {submitting ? '처리 중...' : '판매 완료'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}