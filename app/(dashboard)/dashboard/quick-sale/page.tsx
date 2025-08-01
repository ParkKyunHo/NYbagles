'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

interface Product {
  id: string
  name: string
  price: number
  stock_quantity: number
}

export default function QuickSalePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [todaySales, setTodaySales] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    fetchProducts()
    fetchTodaySales()
  }, [])

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, price, stock_quantity')
      .eq('is_active', true)
      .order('name')

    if (data && !error) {
      setProducts(data)
    }
    setLoading(false)
  }

  const fetchTodaySales = async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('sales_records')
      .select('total_amount')
      .gte('created_at', today)
    
    if (data) {
      const total = data.reduce((sum, sale) => sum + Number(sale.total_amount), 0)
      setTodaySales(total)
    }
  }

  const handleSale = async (product: Product) => {
    if (product.stock_quantity <= 0) {
      alert('재고가 없습니다!')
      return
    }

    try {
      // 1. 판매 기록 생성
      const { error: saleError } = await supabase
        .from('sales_records')
        .insert({
          total_amount: product.price,
          payment_method: 'cash',
          status: 'completed'
        })

      if (saleError) throw saleError

      // 2. 재고 차감
      const { error: stockError } = await supabase
        .from('products')
        .update({ 
          stock_quantity: product.stock_quantity - 1 
        })
        .eq('id', product.id)

      if (stockError) throw stockError

      // 3. 화면 업데이트
      fetchProducts()
      fetchTodaySales()
      
    } catch (error) {
      console.error('Sale error:', error)
      alert('판매 처리 중 오류가 발생했습니다')
    }
  }

  if (loading) {
    return <div className="p-8 text-center">로딩 중...</div>
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-6 bg-yellow-50 p-4 rounded-lg">
        <h1 className="text-2xl font-bold mb-2">🥯 빠른 판매</h1>
        <p className="text-xl">오늘 매출: ₩{todaySales.toLocaleString()}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {products.map((product) => (
          <div key={product.id} className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold">{product.name}</h3>
            <p className="text-gray-600">₩{product.price.toLocaleString()}</p>
            <p className="text-sm text-gray-700 mb-3">재고: {product.stock_quantity}개</p>
            <Button 
              onClick={() => handleSale(product)}
              disabled={product.stock_quantity <= 0}
              className="w-full"
              variant={product.stock_quantity > 0 ? "primary" : "ghost"}
            >
              {product.stock_quantity > 0 ? '판매' : '품절'}
            </Button>
          </div>
        ))}
      </div>

      {products.length === 0 && (
        <div className="text-center py-8 text-gray-700">
          등록된 상품이 없습니다
        </div>
      )}
    </div>
  )
}