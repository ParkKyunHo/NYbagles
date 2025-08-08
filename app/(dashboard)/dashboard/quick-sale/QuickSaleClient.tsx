'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

interface Product {
  id: string
  name: string
  base_price: number
  stock_quantity: number
}

interface QuickSaleClientProps {
  initialProducts: Product[]
  initialTodaySales: number
  storeName: string
  storeId: string
}

export default function QuickSaleClient({ 
  initialProducts, 
  initialTodaySales, 
  storeName,
  storeId
}: QuickSaleClientProps) {
  const [products, setProducts] = useState(initialProducts)
  const [todaySales, setTodaySales] = useState(initialTodaySales)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSale = async (product: Product) => {
    if (product.stock_quantity <= 0) {
      alert('재고가 없습니다!')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/sales/quick', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: product.id,
          storeId: storeId,
          price: product.base_price
        })
      })

      if (!response.ok) {
        throw new Error('판매 처리 실패')
      }

      const result = await response.json()
      
      // 재고 업데이트
      setProducts(prev => prev.map(p => 
        p.id === product.id 
          ? { ...p, stock_quantity: p.stock_quantity - 1 }
          : p
      ))
      
      // 매출 업데이트
      setTodaySales(prev => prev + product.base_price)
      
      // 페이지 새로고침으로 최신 데이터 가져오기
      router.refresh()
    } catch (error) {
      console.error('Sale error:', error)
      alert('판매 처리 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-6 bg-yellow-50 p-4 rounded-lg">
        <h1 className="text-2xl font-bold mb-2">🥯 빠른 판매</h1>
        <p className="text-xl text-black">오늘 매출: ₩{todaySales.toLocaleString()}</p>
        <p className="text-sm text-gray-600 mt-1">매장: {storeName}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {products.map((product) => (
          <div key={product.id} className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-black">{product.name}</h3>
            <p className="text-black">₩{product.base_price.toLocaleString()}</p>
            <p className="text-sm text-black mb-3">재고: {product.stock_quantity}개</p>
            <Button 
              onClick={() => handleSale(product)}
              disabled={product.stock_quantity <= 0 || loading}
              className="w-full"
              variant={product.stock_quantity > 0 ? "primary" : "ghost"}
            >
              {product.stock_quantity > 0 ? '판매' : '품절'}
            </Button>
          </div>
        ))}
      </div>

      {products.length === 0 && (
        <div className="text-center py-8 text-black">
          등록된 상품이 없습니다
        </div>
      )}
    </div>
  )
}