'use client'

import { useState, useEffect } from 'react'
import { createClientWithAuth } from '@/lib/supabase/client-auth'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { StoreSelector } from '@/components/ui/store-selector'

interface Product {
  id: string
  sku: string
  name: string
  base_price: number
  sale_price?: number
  stock_quantity: number
  category: string
  status: string
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
      console.log('[간편상품관리] Fetching profile for user:', user.id)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profileError) {
        console.error('[간편상품관리] Profile fetch error:', profileError)
        // API 라우트를 통해 role 가져오기 시도
        try {
          const response = await fetch('/api/auth/user-role')
          if (response.ok) {
            const data = await response.json()
            console.log('[간편상품관리] Role from API:', data.role)
            setUserRole(data.role)
          }
        } catch (apiError) {
          console.error('[간편상품관리] API fetch error:', apiError)
        }
      } else if (profile) {
        console.log('[간편상품관리] Profile fetched:', profile)
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
      // Fetch from products_v3 (new system)
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
        setProducts(data || [])
      }
    } catch (error) {
      console.error('Error fetching products:', error)
      alert('상품을 불러오는 중 오류가 발생했습니다.')
    }
  }

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.price || !storeId) {
      alert('상품명과 가격을 입력해주세요')
      return
    }

    try {
      // 1. 먼저 products_v3에 상품 생성 (draft 상태)
      const { data: product, error: productError } = await supabase
        .from('products_v3')
        .insert({
          store_id: storeId,
          sku: 'SKU-' + Date.now(),
          name: newProduct.name,
          base_price: parseFloat(newProduct.price),
          stock_quantity: parseInt(newProduct.stock_quantity) || 0,
          category: newProduct.category,
          status: 'draft',
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single()

      if (productError || !product) {
        throw productError || new Error('상품 생성 실패')
      }

      // 2. 승인 요청 생성
      const { error: changeError } = await supabase
        .from('product_changes')
        .insert({
          product_id: product.id,
          change_type: 'create',
          new_values: {
            name: newProduct.name,
            base_price: parseFloat(newProduct.price),
            stock_quantity: parseInt(newProduct.stock_quantity) || 0,
            category: newProduct.category
          },
          change_reason: '신규 상품 등록',
          requested_by: (await supabase.auth.getUser()).data.user?.id
        })

      if (changeError) {
        // 실패 시 상품도 삭제
        await supabase.from('products_v3').delete().eq('id', product.id)
        throw changeError
      }

      alert('상품 등록 요청이 제출되었습니다. 승인 후 판매가 가능합니다.')
      setNewProduct({ name: '', price: '', stock_quantity: '0', category: '베이글' })
      setShowAddForm(false)
      await fetchProducts(storeId)
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
      // 현재 상품 정보 가져오기
      const { data: currentProduct } = await supabase
        .from('products_v3')
        .select('*')
        .eq('id', id)
        .single()

      if (!currentProduct) {
        throw new Error('상품을 찾을 수 없습니다')
      }

      // 변경 요청 생성
      const { error } = await supabase
        .from('product_changes')
        .insert({
          product_id: id,
          change_type: 'update',
          old_values: {
            name: currentProduct.name,
            base_price: currentProduct.base_price,
            stock_quantity: currentProduct.stock_quantity,
            category: currentProduct.category
          },
          new_values: {
            name: editProduct.name,
            base_price: parseFloat(editProduct.price),
            stock_quantity: parseInt(editProduct.stock_quantity) || 0,
            category: editProduct.category
          },
          change_reason: '상품 정보 수정',
          requested_by: (await supabase.auth.getUser()).data.user?.id
        })

      if (!error) {
        alert('상품 수정 요청이 제출되었습니다. 승인 후 반영됩니다.')
        setEditingId(null)
        if (storeId) await fetchProducts(storeId)
      } else {
        alert('상품 수정 요청 중 오류가 발생했습니다')
      }
    } catch (error) {
      console.error('Error updating product:', error)
      alert('상품 수정 중 오류가 발생했습니다')
    }
  }

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      // 삭제 요청 생성
      const { error } = await supabase
        .from('product_changes')
        .insert({
          product_id: id,
          change_type: 'delete',
          new_values: { status: 'archived' },
          change_reason: '상품 삭제',
          requested_by: (await supabase.auth.getUser()).data.user?.id
        })

      if (!error) {
        alert('상품 삭제 요청이 제출되었습니다. 승인 후 삭제됩니다.')
        if (storeId) await fetchProducts(storeId)
      } else {
        alert('상품 삭제 요청 중 오류가 발생했습니다')
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
      price: product.base_price.toString(),
      stock_quantity: product.stock_quantity.toString(),
      category: product.category
    })
  }

  const handleStoreChange = async (newStoreId: string, newStoreName: string) => {
    setStoreId(newStoreId)
    setStoreName(newStoreName)
    setLoading(true)
    setShowAddForm(false)
    setEditingId(null)
    
    try {
      await fetchProducts(newStoreId)
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

  const categories = Array.from(new Set(products.map(p => p.category))).sort()

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h1 className="text-2xl font-bold">상품 관리</h1>
            <p className="text-black">{storeName}</p>
          </div>
          <div className="flex items-center gap-4">
            <StoreSelector
              selectedStoreId={storeId}
              onStoreChange={handleStoreChange}
              userRole={userRole}
            />
            {(userRole === 'super_admin' || userRole === 'admin' || userRole === 'manager') && (
              <Button onClick={() => setShowAddForm(!showAddForm)}>
                <Plus className="w-4 h-4 mr-2" />
                상품 추가
              </Button>
            )}
          </div>
        </div>
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
                .filter(p => p.category === category && p.status === 'active')
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
                        <h3 className="font-semibold text-lg text-black">{product.name}</h3>
                        <p className="text-black">₩{product.base_price.toLocaleString()}</p>
                        <div className="flex items-center justify-between text-sm text-black mb-3">
                          <span>재고: {product.stock_quantity}개</span>
                          {userRole !== 'employee' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingId(product.id)
                                setEditProduct({
                                  name: product.name,
                                  price: product.base_price.toString(),
                                  stock_quantity: product.stock_quantity.toString(),
                                  category: product.category
                                })
                              }}
                              className="text-bagel-yellow hover:text-bagel-yellow-dark px-2 py-1"
                            >
                              재고 수정
                            </Button>
                          )}
                        </div>
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
        <div className="text-center py-12 text-black">
          <p>등록된 상품이 없습니다.</p>
          <p className="text-sm mt-2">상품을 추가해주세요.</p>
        </div>
      )}
    </div>
  )
}