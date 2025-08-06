'use client'

import { useState, useEffect } from 'react'
import { createClientWithAuth } from '@/lib/supabase/client-auth'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useRouter } from 'next/navigation'
import { StoreSelector } from '@/components/ui/store-selector'

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
  const [userRole, setUserRole] = useState<string>('')
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

      // Get user role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile) {
        setUserRole(profile.role)
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
      // Use products_v3 with active status
      const { data, error } = await supabase
        .from('products_v3')
        .select('*')
        .eq('store_id', storeId)
        .eq('status', 'active')
        .order('category')
        .order('name')

      if (error) {
        console.error('Error fetching products:', error)
        alert('상품을 불러오는 중 오류가 발생했습니다.')
      } else {
        const formattedProducts = data?.map(p => ({
          id: p.id,
          name: p.name,
          price: p.base_price,
          stock_quantity: p.stock_quantity,
          category: p.category
        })) || []
        
        console.log('Fetched products with stock:', formattedProducts.map(p => ({
          name: p.name,
          stock: p.stock_quantity
        })))
        
        setProducts(formattedProducts)
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const fetchTodaySales = async (storeId: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    try {
      // Use sales_transactions table
      const { data, error } = await supabase
        .from('sales_transactions')
        .select('total_amount')
        .eq('store_id', storeId)
        .eq('payment_status', 'completed')
        .gte('sold_at', today.toISOString())

      if (error) {
        console.error('Error fetching today sales:', error)
      } else {
        const total = data?.reduce((sum, sale) => sum + Number(sale.total_amount), 0) || 0
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

      // Calculate totals
      const subtotal = getCartTotal()
      const taxAmount = 0 // No tax for now
      const discountAmount = 0 // No discount for now
      const totalAmount = subtotal

      // Create sales transaction
      const { data: transaction, error: transactionError } = await supabase
        .from('sales_transactions')
        .insert({
          store_id: storeId,
          subtotal,
          tax_amount: taxAmount,
          discount_amount: discountAmount,
          total_amount: totalAmount,
          payment_method: 'cash',
          payment_status: 'completed',
          sold_by: user.id
        })
        .select()
        .single()

      if (transactionError) {
        throw transactionError
      }

      // Create sales items and update stock
      for (const item of cart) {
        // Get current stock
        const { data: product } = await supabase
          .from('products_v3')
          .select('stock_quantity')
          .eq('id', item.product.id)
          .single()

        if (!product) continue

        const stockBefore = product.stock_quantity
        const stockAfter = stockBefore - item.quantity

        // Create sales item
        const { error: itemError } = await supabase
          .from('sales_items')
          .insert({
            transaction_id: transaction.id,
            product_id: item.product.id,
            quantity: item.quantity,
            unit_price: item.product.price,
            discount_amount: 0,
            total_amount: item.product.price * item.quantity,
            stock_before: stockBefore,
            stock_after: stockAfter
          })

        if (itemError) {
          console.error('Error creating sales item:', itemError)
        }
      }

      // Clear cart and refresh
      setCart([])
      // 트리거가 재고를 업데이트하므로 약간의 지연 후 새로고침
      setTimeout(async () => {
        await fetchProducts(storeId)
        await fetchTodaySales(storeId)
      }, 500)
      alert('판매가 완료되었습니다!')
      
    } catch (error) {
      console.error('Error processing sale:', error)
      alert('판매 처리 중 오류가 발생했습니다')
    }
  }

  const handleStoreChange = async (newStoreId: string, newStoreName: string) => {
    setStoreId(newStoreId)
    setStoreName(newStoreName)
    setLoading(true)
    setCart([]) // Clear cart when changing stores
    
    try {
      await fetchProducts(newStoreId)
      await fetchTodaySales(newStoreId)
    } catch (error) {
      console.error('Error changing store:', error)
    } finally {
      setLoading(false)
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-bagel-black mb-2">🥯 {storeName} - 판매</h1>
            <p className="text-xl text-bagel-black">오늘 매출: ₩{todayTotal.toLocaleString()}</p>
          </div>
          <StoreSelector
            selectedStoreId={storeId}
            onStoreChange={handleStoreChange}
            userRole={userRole}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products Section */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold mb-4">상품 목록</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {products.map(product => (
              <Card key={product.id} className="p-4">
                <h3 className="font-semibold text-lg text-black">{product.name}</h3>
                <p className="text-black">₩{product.price.toLocaleString()}</p>
                <p className="text-sm text-black mb-3">재고: {product.stock_quantity}개</p>
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
              <p className="text-black text-center py-8">상품을 선택해주세요</p>
            ) : (
              <>
                <div className="space-y-3 mb-4">
                  {cart.map(item => (
                    <div key={item.product.id} className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-black">{item.product.name}</p>
                        <p className="text-sm text-black">
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