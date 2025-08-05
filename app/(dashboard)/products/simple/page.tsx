'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Plus, Trash2 } from 'lucide-react'

interface Product {
  id: string
  name: string
  price: number
  stock_quantity: number
  category: string
}

export default function SimpleProductManagementPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newProduct, setNewProduct] = useState({
    name: '',
    price: '',
    stock_quantity: '0',
    category: '베이글'
  })
  const supabase = createClient()

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (data) {
      setProducts(data)
    }
  }

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.price) {
      alert('상품명과 가격을 입력해주세요')
      return
    }

    const { error } = await supabase
      .from('products')
      .insert({
        name: newProduct.name,
        price: parseFloat(newProduct.price),
        stock_quantity: parseInt(newProduct.stock_quantity),
        category: newProduct.category
      })

    if (!error) {
      setNewProduct({ name: '', price: '', stock_quantity: '0', category: '베이글' })
      setShowAddForm(false)
      fetchProducts()
    } else {
      alert('상품 추가 중 오류가 발생했습니다')
    }
  }

  const handleUpdateStock = async (id: string, newStock: number) => {
    const { error } = await supabase
      .from('products')
      .update({ stock_quantity: newStock })
      .eq('id', id)

    if (!error) {
      fetchProducts()
    }
  }

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', id)

    if (!error) {
      fetchProducts()
    }
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">상품 관리 (심플)</h1>
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          <Plus className="w-4 h-4 mr-2" />
          상품 추가
        </Button>
      </div>

      {showAddForm && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-3">새 상품 추가</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="상품명"
              value={newProduct.name}
              onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
              className="px-3 py-2 border rounded"
            />
            <input
              type="number"
              placeholder="가격"
              value={newProduct.price}
              onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
              className="px-3 py-2 border rounded"
            />
            <input
              type="number"
              placeholder="초기 재고"
              value={newProduct.stock_quantity}
              onChange={(e) => setNewProduct({ ...newProduct, stock_quantity: e.target.value })}
              className="px-3 py-2 border rounded"
            />
            <Button onClick={handleAddProduct}>추가</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {products.map((product) => (
          <div key={product.id} className="bg-white p-4 rounded-lg shadow flex justify-between items-center">
            <div>
              <h3 className="font-semibold">{product.name}</h3>
              <p className="text-black">₩{product.price.toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm">재고:</label>
                <input
                  type="number"
                  value={product.stock_quantity}
                  onChange={(e) => handleUpdateStock(product.id, parseInt(e.target.value) || 0)}
                  className="w-20 px-2 py-1 border rounded"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteProduct(product.id)}
                className="text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}