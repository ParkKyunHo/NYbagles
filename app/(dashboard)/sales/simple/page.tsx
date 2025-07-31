'use client'

import { useState, useEffect } from 'react'
import { createClientWithAuth } from '@/lib/supabase/client-auth'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useRouter } from 'next/navigation'

interface Product {
  id: string
  name: string
  price: number
  stock_quantity: number
  category: string
}

interface SaleItem {
  product: Product
  quantity: number
}

export default function SimpleSalesPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<SaleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [storeName, setStoreName] = useState<string>('')
  const [todayTotal, setTodayTotal] = useState(0)
  const router = useRouter()
  const supabase = createClientWithAuth()

  useEffect(() => {
    checkUserStore()
  }, [])

  const checkUserStore = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Get user's store
      const { data: employee } = await supabase
        .from('employees')
        .select('store_id, stores(id, name)')
        .eq('user_id', user.id)
        .single()

      if (employee?.store_id) {
        setStoreId(employee.store_id)
        setStoreName((employee as any).stores?.name || '')
        await fetchProducts(employee.store_id)
        await fetchTodaySales(employee.store_id)
      } else {
        // For admin, get first store
        const { data: firstStore } = await supabase
          .from('stores')
          .select('id, name')
          .limit(1)
          .single()

        if (firstStore) {
          setStoreId(firstStore.id)
          setStoreName(firstStore.name)
          await fetchProducts(firstStore.id)
          await fetchTodaySales(firstStore.id)
        }
      }
    } catch (error) {
      console.error('Error checking user store:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchProducts = async (storeId: string) => {
    try {
      // First try products_v2
      let { data, error } = await supabase
        .from('products_v2')
        .select('*')
        .eq('store_id', storeId)
        .eq('is_active', true)
        .order('category')
        .order('name')

      if (error || !data || data.length === 0) {
        // Fallback to products table
        const { data: oldProducts } = await supabase
          .from('products')
          .select('*, store_products!inner(stock_quantity)')
          .eq('store_products.store_id', storeId)
          .eq('is_active', true)
          .order('name')

        if (oldProducts) {
          setProducts(oldProducts.map(p => ({
            id: p.id,
            name: p.name,
            price: p.price,
            stock_quantity: p.store_products[0]?.stock_quantity || 0,
            category: '베이글'
          })))
        }
      } else {
        setProducts(data)
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const fetchTodaySales = async (storeId: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    try {
      // First try new sales table
      let { data, error } = await supabase
        .from('sales')
        .select('total_amount')
        .eq('store_id', storeId)
        .gte('sold_at', today.toISOString())

      if (error || !data || data.length === 0) {
        // Fallback to sales_records
        const { data: oldSales } = await supabase
          .from('sales_records')
          .select('total_amount')
          .eq('store_id', storeId)
          .gte('created_at', today.toISOString())

        if (oldSales) {
          const total = oldSales.reduce((sum, sale) => sum + Number(sale.total_amount), 0)
          setTodayTotal(total)
        }
      } else {
        const total = data.reduce((sum, sale) => sum + Number(sale.total_amount), 0)
        setTodayTotal(total)
      }
    } catch (error) {
      console.error('Error fetching today sales:', error)
    }
  }

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.product.id === product.id)
    if (existing) {
      setCart(cart.map(item => 
        item.product.id === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      setCart([...cart, { product, quantity: 1 }])
    }
  }

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId))
  }

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId)
    } else {
      setCart(cart.map(item => 
        item.product.id === productId 
          ? { ...item, quantity }
          : item
      ))
    }
  }

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.product.price * item.quantity), 0)
  }

  const processSale = async () => {
    if (cart.length === 0) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !storeId) return

      // Process each item in cart
      for (const item of cart) {
        // Try new sales table first
        const { error: saleError } = await supabase
          .from('sales')
          .insert({
            store_id: storeId,
            product_id: item.product.id,
            quantity: item.quantity,
            unit_price: item.product.price,
            total_amount: item.product.price * item.quantity,
            sold_by: user.id
          })

        if (saleError) {
          // Fallback to old system
          await supabase
            .from('sales_records')
            .insert({
              store_id: storeId,
              total_amount: item.product.price * item.quantity,
              payment_method: 'cash',
              status: 'completed'
            })

          // Update stock manually for old system
          await supabase
            .from('store_products')
            .update({ 
              stock_quantity: item.product.stock_quantity - item.quantity 
            })
            .eq('store_id', storeId)
            .eq('product_id', item.product.id)
        }
      }

      // Clear cart and refresh
      setCart([])
      await fetchProducts(storeId)
      await fetchTodaySales(storeId)
      alert('판매가 완료되었습니다!')
      
    } catch (error) {
      console.error('Error processing sale:', error)
      alert('판매 처리 중 오류가 발생했습니다')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-bagel-yellow"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="mb-6 bg-bagel-yellow p-4 rounded-lg">
        <h1 className="text-2xl font-bold text-bagel-black mb-2">🥯 {storeName} - 판매</h1>
        <p className="text-xl text-bagel-black">오늘 매출: ₩{todayTotal.toLocaleString()}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products Section */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold mb-4">상품 목록</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {products.map(product => (
              <Card key={product.id} className="p-4">
                <h3 className="font-semibold text-lg">{product.name}</h3>
                <p className="text-gray-600">₩{product.price.toLocaleString()}</p>
                <p className="text-sm text-gray-500 mb-3">재고: {product.stock_quantity}개</p>
                <Button
                  onClick={() => addToCart(product)}
                  disabled={product.stock_quantity <= 0}
                  className="w-full"
                  variant={product.stock_quantity > 0 ? "primary" : "secondary"}
                >
                  {product.stock_quantity > 0 ? '담기' : '품절'}
                </Button>
              </Card>
            ))}
          </div>
        </div>

        {/* Cart Section */}
        <div>
          <h2 className="text-lg font-semibold mb-4">주문 내역</h2>
          <Card className="p-4">
            {cart.length === 0 ? (
              <p className="text-gray-500 text-center py-8">상품을 선택해주세요</p>
            ) : (
              <>
                <div className="space-y-3 mb-4">
                  {cart.map(item => (
                    <div key={item.product.id} className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{item.product.name}</p>
                        <p className="text-sm text-gray-600">
                          ₩{item.product.price.toLocaleString()} × {item.quantity}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        >
                          -
                        </Button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          disabled={item.quantity >= item.product.stock_quantity}
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-4">
                  <div className="flex justify-between mb-4">
                    <span className="font-semibold">합계</span>
                    <span className="font-semibold">₩{getCartTotal().toLocaleString()}</span>
                  </div>
                  <Button 
                    onClick={processSale}
                    className="w-full"
                  >
                    결제하기
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}