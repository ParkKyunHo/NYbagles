'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { salesService } from '@/lib/services/sales.service'
import { ShoppingCart, Plus, Minus, X, CreditCard, DollarSign, Package, Edit2, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import QuickStockUpdateModal from '@/components/products/QuickStockUpdateModal'
import type { Product, CreateSaleItem, PaymentMethod } from '@/types/sales'
import type { RealtimeChannel } from '@supabase/supabase-js'

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
  const [selectedProductForStock, setSelectedProductForStock] = useState<Product | null>(null)
  const [isStockModalOpen, setIsStockModalOpen] = useState(false)
  const [realtimeChannel, setRealtimeChannel] = useState<RealtimeChannel | null>(null)
  const [updatedProductIds, setUpdatedProductIds] = useState<Set<string>>(new Set())
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkAuthAndLoadData()
  }, [])

  // Real-time subscription for stock updates
  useEffect(() => {
    if (!selectedStoreId) return

    // Clean up previous subscription if exists
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel)
    }

    // Create new subscription for the selected store's products
    const channel = supabase
      .channel(`products-stock-${selectedStoreId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'products',
          filter: `store_id=eq.${selectedStoreId}`
        },
        (payload) => {
          console.log('Stock update received:', payload)
          
          if (payload.eventType === 'UPDATE') {
            // Update the specific product in the state
            setProducts(prevProducts => 
              prevProducts.map(product => 
                product.id === payload.new.id
                  ? {
                      ...product,
                      stock_quantity: payload.new.stock_quantity,
                      name: payload.new.name,
                      base_price: payload.new.base_price,
                      price: payload.new.base_price,
                      status: payload.new.status
                    }
                  : product
              )
            )
            
            // Add visual indicator for updated product
            setUpdatedProductIds(prev => new Set([...prev, payload.new.id]))
            
            // Remove visual indicator after 2 seconds
            setTimeout(() => {
              setUpdatedProductIds(prev => {
                const newSet = new Set(prev)
                newSet.delete(payload.new.id)
                return newSet
              })
            }, 2000)
          } else if (payload.eventType === 'INSERT') {
            // Add new product to the list
            const newProduct: Product = {
              id: payload.new.id,
              name: payload.new.name,
              description: payload.new.description,
              sku: payload.new.sku,
              category_id: payload.new.category || '',
              price: payload.new.base_price || payload.new.price,
              unit: payload.new.unit || '개',
              display_order: payload.new.display_order,
              is_active: payload.new.is_active ?? true,
              created_at: payload.new.created_at,
              updated_at: payload.new.updated_at,
              stock_quantity: payload.new.stock_quantity,
              product_categories: { 
                id: payload.new.category || '', 
                name: payload.new.category || '',
                description: null,
                display_order: 0,
                is_active: true,
                created_at: ''
              }
            }
            setProducts(prevProducts => [...prevProducts, newProduct])
          } else if (payload.eventType === 'DELETE') {
            // Remove deleted product from the list
            setProducts(prevProducts => 
              prevProducts.filter(product => product.id !== payload.old.id)
            )
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsRealtimeConnected(true)
          console.log('Real-time subscription connected')
        } else if (status === 'CHANNEL_ERROR') {
          setIsRealtimeConnected(false)
          console.error('Real-time subscription error')
        } else if (status === 'TIMED_OUT') {
          setIsRealtimeConnected(false)
          console.error('Real-time subscription timed out')
        } else if (status === 'CLOSED') {
          setIsRealtimeConnected(false)
          console.log('Real-time subscription closed')
        }
      })

    setRealtimeChannel(channel)

    // Cleanup function
    return () => {
      if (channel) {
        setIsRealtimeConnected(false)
        supabase.removeChannel(channel)
      }
    }
  }, [selectedStoreId, supabase])

  const checkAuthAndLoadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/login')
      return
    }

    // 사용자 프로필 조회
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      alert('사용자 정보를 찾을 수 없습니다.')
      router.push('/dashboard')
      return
    }

    setUserRole(profile.role)
    
    // 직원 정보에서 store_id 가져오기
    const { data: employee } = await supabase
      .from('employees')
      .select('store_id')
      .eq('user_id', user.id)
      .single()

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
      if (!employee || !employee.store_id) {
        alert('매장 정보를 찾을 수 없습니다.')
        router.push('/dashboard')
        return
      }

      const { data: storeData } = await supabase
        .from('stores')
        .select('id, name, code')
        .eq('id', employee.store_id)
        .single()

      if (storeData) {
        setStore(storeData)
        setSelectedStoreId(storeData.id)
        await fetchProducts(storeData.id)
      } else {
        alert('매장이 할당되지 않았습니다. 관리자에게 문의하세요.')
        router.push('/dashboard')
      }
    }
  }

  const fetchProducts = async (storeId: string) => {
    setLoading(true)
    
    try {
      // 매장의 판매 가능한 상품 조회 (products 사용)
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', storeId)
        .eq('status', 'active')
        .order('category')
        .order('name')

      if (error) throw error

      // products 형식으로 데이터 변환
      const productsWithPrice = data?.map(product => ({
        ...product,
        price: product.base_price,
        product_categories: { id: product.category, name: product.category }
      })) || []

      setProducts(productsWithPrice)

      // 카테고리 추출
      const uniqueCategories = Array.from(
        new Set(productsWithPrice.map(p => p.category))
      ).map(cat => ({ id: cat, name: cat }))
      
      setCategories(uniqueCategories)
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  // 재고 수정 권한 확인
  const canEditStock = () => {
    return userRole === 'manager' || userRole === 'admin' || userRole === 'super_admin'
  }

  // 재고 수정 모달 열기
  const openStockModal = (product: Product) => {
    setSelectedProductForStock(product)
    setIsStockModalOpen(true)
  }

  // 재고 업데이트 성공 후 처리
  const handleStockUpdateSuccess = async () => {
    // Real-time subscription will automatically update the stock
    // No need to refetch products manually
    console.log('Stock updated successfully - real-time update will reflect changes')
  }

  const addToCart = (product: Product) => {
    // 재고가 0인 경우 경고
    if (product.stock_quantity !== undefined && product.stock_quantity <= 0) {
      alert('재고가 부족합니다.')
      return
    }

    const existingItem = cart.find(item => item.product_id === product.id)
    
    if (existingItem) {
      // 재고 체크
      if (product.stock_quantity !== undefined && existingItem.quantity + 1 > product.stock_quantity) {
        alert(`재고가 부족합니다. 현재 재고: ${product.stock_quantity}개`)
        return
      }
      updateQuantity(product.id, existingItem.quantity + 1)
    } else {
      setCart([...cart, {
        product_id: product.id,
        quantity: 1,
        unit_price: product.price,
        subtotal: product.price,
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

    // 재고 체크
    const product = products.find(p => p.id === productId)
    if (product && product.stock_quantity !== undefined && quantity > product.stock_quantity) {
      alert(`재고가 부족합니다. 현재 재고: ${product.stock_quantity}개`)
      return
    }

    setCart(cart.map(item => 
      item.product_id === productId
        ? { ...item, quantity, subtotal: quantity * item.unit_price }
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
      const totalAmount = cart.reduce((sum, item) => sum + item.subtotal - (item.discount_amount || 0), 0)
      const saleData = {
        store_id: selectedStoreId || store?.id || '',
        items: cart.map(({ product, ...item }) => item),
        total_amount: totalAmount,
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
        // Real-time subscription will automatically update the stock
        // No need to refetch products after sale
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
          <p className="mt-4 text-black">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-black">판매 관리</h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-black">{store?.name} - 판매 입력</p>
                {/* Real-time connection status */}
                <div className="flex items-center gap-1">
                  {isRealtimeConnected ? (
                    <>
                      <Wifi className="h-4 w-4 text-green-600" />
                      <span className="text-xs text-green-600">실시간 연결됨</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-4 w-4 text-gray-400" />
                      <span className="text-xs text-gray-400">연결 대기중</span>
                    </>
                  )}
                </div>
              </div>
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
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow text-black bg-white"
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
                      : 'bg-gray-100 text-black hover:bg-gray-200'
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
                        : 'bg-gray-100 text-black hover:bg-gray-200'
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
                  <div
                    key={product.id}
                    className={`bg-gray-50 border-2 rounded-lg p-4 hover:border-bagel-yellow hover:bg-yellow-50 transition-all relative ${
                      updatedProductIds.has(product.id) 
                        ? 'border-green-500 animate-pulse bg-green-50' 
                        : 'border-gray-200'
                    }`}
                  >
                    {/* 재고 수정 버튼 (권한이 있는 경우에만 표시) */}
                    {canEditStock() && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openStockModal(product)
                        }}
                        className="absolute top-2 right-2 p-1 bg-white rounded-md shadow-sm hover:bg-gray-100 transition-colors"
                        title="재고 수정"
                      >
                        <Edit2 className="h-4 w-4 text-gray-600" />
                      </button>
                    )}
                    
                    <button
                      onClick={() => addToCart(product)}
                      className="w-full text-left"
                      disabled={product.stock_quantity === 0}
                    >
                      <h3 className="font-medium text-black mb-1">
                        {product.name}
                      </h3>
                      <p className="text-bagel-yellow font-bold text-lg">
                        ₩{product.price.toLocaleString()}
                      </p>
                      
                      {/* 재고 표시 - 항상 표시 */}
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <Package className={`h-4 w-4 ${
                              (product.stock_quantity ?? 0) === 0 
                                ? 'text-red-500' 
                                : (product.stock_quantity ?? 0) < 10 
                                  ? 'text-orange-500' 
                                  : 'text-green-600'
                            }`} />
                            <span className={`text-sm font-medium ${
                              (product.stock_quantity ?? 0) === 0 
                                ? 'text-red-600' 
                                : (product.stock_quantity ?? 0) < 10 
                                  ? 'text-orange-600' 
                                  : 'text-green-700'
                            }`}>
                              재고: {product.stock_quantity !== undefined ? product.stock_quantity : 0}개
                            </span>
                          </div>
                          {(product.stock_quantity ?? 0) === 0 && (
                            <span className="text-xs text-red-600 font-bold bg-red-50 px-2 py-1 rounded">
                              품절
                            </span>
                          )}
                          {(product.stock_quantity ?? 0) > 0 && (product.stock_quantity ?? 0) < 10 && (
                            <span className="text-xs text-orange-600 font-medium bg-orange-50 px-2 py-1 rounded">
                              부족
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 장바구니 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6 sticky top-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-black flex items-center">
                <ShoppingCart className="h-5 w-5 mr-2" />
                장바구니
              </h2>
              <span className="text-sm text-black">
                {cart.length}개 상품
              </span>
            </div>

            {/* 장바구니 아이템 */}
            <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
              {cart.length === 0 ? (
                <p className="text-center text-black py-8">
                  상품을 선택해주세요
                </p>
              ) : (
                cart.map((item) => (
                  <div key={item.product_id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-black flex-1">
                        {item.product.name}
                      </h4>
                      <button
                        onClick={() => removeFromCart(item.product_id)}
                        className="text-black hover:text-red-600"
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
              <label className="block text-sm font-medium text-black mb-2">
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
                        ? 'border-bagel-yellow bg-yellow-50 text-black'
                        : 'border-gray-200 hover:border-gray-300 text-black'
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
              <label className="block text-sm font-medium text-black mb-2">
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
                <span className="text-lg font-bold text-black">합계</span>
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

      {/* 재고 수정 모달 */}
      {selectedProductForStock && (
        <QuickStockUpdateModal
          product={{
            id: selectedProductForStock.id,
            name: selectedProductForStock.name,
            stock_quantity: selectedProductForStock.stock_quantity ?? 0,
            category: selectedProductForStock.product_categories?.name || ''
          }}
          isOpen={isStockModalOpen}
          onClose={() => {
            setIsStockModalOpen(false)
            setSelectedProductForStock(null)
          }}
          onSuccess={handleStockUpdateSuccess}
        />
      )}
    </>
  )
}