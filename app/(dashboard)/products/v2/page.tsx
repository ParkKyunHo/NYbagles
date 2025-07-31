'use client'

import { useState, useEffect } from 'react'
import { createClientWithAuth } from '@/lib/supabase/client-auth'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Product {
  id: string
  name: string
  price: number
  stock_quantity: number
  category: string
  is_active: boolean
}

export default function ProductsV2Page() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [storeName, setStoreName] = useState<string>('')
  const [userRole, setUserRole] = useState<string>('')
  
  const [newProduct, setNewProduct] = useState({
    name: '',
    price: '',
    stock_quantity: '0',
    category: '베이글'
  })
  
  const [editProduct, setEditProduct] = useState({
    name: '',
    price: '',
    stock_quantity: '',
    category: ''
  })
  
  const router = useRouter()
  const supabase = createClientWithAuth()

  useEffect(() => {
    initializePage()
  }, [])

  const initializePage = async () => {
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
      } else if (profile?.role === 'super_admin' || profile?.role === 'admin') {
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
        }
      }
    } catch (error) {
      console.error('Error initializing page:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchProducts = async (storeId: string) => {
    try {
      // Try products_v2 first
      let { data, error } = await supabase
        .from('products_v2')
        .select('*')
        .eq('store_id', storeId)
        .order('category')
        .order('name')

      if (error || !data || data.length === 0) {
        // Fallback to migrate from old products
        const { data: oldProducts } = await supabase
          .from('products')
          .select('*, store_products!inner(stock_quantity), product_categories(name)')
          .eq('store_products.store_id', storeId)
          .order('name')

        if (oldProducts && oldProducts.length > 0) {
          // Migrate to products_v2
          for (const oldProduct of oldProducts) {
            await supabase
              .from('products_v2')
              .insert({
                store_id: storeId,
                name: oldProduct.name,
                category: oldProduct.product_categories?.name || '베이글',
                price: oldProduct.price,
                stock_quantity: oldProduct.store_products[0]?.stock_quantity || 0,
                is_active: oldProduct.is_active
              })
          }
          
          // Fetch again
          const { data: newData } = await supabase
            .from('products_v2')
            .select('*')
            .eq('store_id', storeId)
            .order('category')
            .order('name')
          
          if (newData) {
            setProducts(newData)
          }
        }
      } else {
        setProducts(data)
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.price || !storeId) {
      alert('상품명과 가격을 입력해주세요')
      return
    }

    try {
      const { error } = await supabase
        .from('products_v2')
        .insert({
          store_id: storeId,
          name: newProduct.name,
          price: parseFloat(newProduct.price),
          stock_quantity: parseInt(newProduct.stock_quantity) || 0,
          category: newProduct.category
        })

      if (!error) {
        setNewProduct({ name: '', price: '', stock_quantity: '0', category: '베이글' })
        setShowAddForm(false)
        await fetchProducts(storeId)
      } else {
        alert('상품 추가 중 오류가 발생했습니다')
      }
    } catch (error) {
      console.error('Error adding product:', error)
      alert('상품 추가 중 오류가 발생했습니다')
    }
  }

  const handleUpdateProduct = async (id: string) => {
    if (!editProduct.name || !editProduct.price) {
      alert('상품명과 가격을 입력해주세요')
      return
    }

    try {
      const { error } = await supabase
        .from('products_v2')
        .update({
          name: editProduct.name,
          price: parseFloat(editProduct.price),
          stock_quantity: parseInt(editProduct.stock_quantity) || 0,
          category: editProduct.category
        })
        .eq('id', id)

      if (!error) {
        setEditingId(null)
        if (storeId) await fetchProducts(storeId)
      } else {
        alert('상품 수정 중 오류가 발생했습니다')
      }
    } catch (error) {
      console.error('Error updating product:', error)
      alert('상품 수정 중 오류가 발생했습니다')
    }
  }

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      const { error } = await supabase
        .from('products_v2')
        .update({ is_active: false })
        .eq('id', id)

      if (!error && storeId) {
        await fetchProducts(storeId)
      }
    } catch (error) {
      console.error('Error deleting product:', error)
      alert('상품 삭제 중 오류가 발생했습니다')
    }
  }

  const startEdit = (product: Product) => {
    setEditingId(product.id)
    setEditProduct({
      name: product.name,
      price: product.price.toString(),
      stock_quantity: product.stock_quantity.toString(),
      category: product.category
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-bagel-yellow"></div>
      </div>
    )
  }

  const categories = Array.from(new Set(products.map(p => p.category))).sort()

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">상품 관리</h1>
          <p className="text-gray-600">{storeName}</p>
        </div>
        {(userRole === 'super_admin' || userRole === 'admin' || userRole === 'manager') && (
          <Button onClick={() => setShowAddForm(!showAddForm)}>
            <Plus className="w-4 h-4 mr-2" />
            상품 추가
          </Button>
        )}
      </div>

      {showAddForm && (
        <Card className="mb-6 p-4">
          <h3 className="font-semibold mb-3">새 상품 추가</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <input
              placeholder="상품명"
              value={newProduct.name}
              onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
              className="px-3 py-2 border rounded-md"
            />
            <input
              type="number"
              placeholder="가격"
              value={newProduct.price}
              onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
              className="px-3 py-2 border rounded-md"
            />
            <input
              type="number"
              placeholder="초기 재고"
              value={newProduct.stock_quantity}
              onChange={(e) => setNewProduct({ ...newProduct, stock_quantity: e.target.value })}
              className="px-3 py-2 border rounded-md"
            />
            <select
              value={newProduct.category}
              onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
              className="px-3 py-2 border rounded-md"
            >
              <option value="베이글">베이글</option>
              <option value="음료">음료</option>
              <option value="스프레드">스프레드</option>
              <option value="기타">기타</option>
            </select>
            <div className="flex gap-2">
              <Button onClick={handleAddProduct} className="flex-1">추가</Button>
              <Button 
                onClick={() => setShowAddForm(false)} 
                variant="outline"
                className="flex-1"
              >
                취소
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-6">
        {categories.map(category => (
          <div key={category}>
            <h2 className="text-lg font-semibold mb-3">{category}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products
                .filter(p => p.category === category && p.is_active)
                .map(product => (
                  <Card key={product.id} className="p-4">
                    {editingId === product.id ? (
                      <div className="space-y-3">
                        <input
                          value={editProduct.name}
                          onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })}
                          placeholder="상품명"
                          className="px-3 py-2 border rounded-md w-full"
                        />
                        <input
                          type="number"
                          value={editProduct.price}
                          onChange={(e) => setEditProduct({ ...editProduct, price: e.target.value })}
                          placeholder="가격"
                          className="px-3 py-2 border rounded-md w-full"
                        />
                        <input
                          type="number"
                          value={editProduct.stock_quantity}
                          onChange={(e) => setEditProduct({ ...editProduct, stock_quantity: e.target.value })}
                          placeholder="재고"
                          className="px-3 py-2 border rounded-md w-full"
                        />
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            onClick={() => handleUpdateProduct(product.id)}
                            className="flex-1"
                          >
                            <Save className="w-4 h-4 mr-1" />
                            저장
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => setEditingId(null)}
                            className="flex-1"
                          >
                            <X className="w-4 h-4 mr-1" />
                            취소
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h3 className="font-semibold text-lg">{product.name}</h3>
                        <p className="text-gray-600">₩{product.price.toLocaleString()}</p>
                        <p className="text-sm text-gray-500 mb-3">재고: {product.stock_quantity}개</p>
                        {(userRole === 'super_admin' || userRole === 'admin' || userRole === 'manager') && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEdit(product)}
                              className="flex-1"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteProduct(product.id)}
                              className="flex-1 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </Card>
                ))}
            </div>
          </div>
        ))}
      </div>

      {products.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>등록된 상품이 없습니다.</p>
          <p className="text-sm mt-2">상품을 추가해주세요.</p>
        </div>
      )}
    </div>
  )
}