'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface Product {
  id: string
  sku: string
  name: string
  base_price: number
  stock_quantity: number
  category: string
  status: string
  store_id: string
}

export default function EditProductPage() {
  const params = useParams()
  const productId = params.id as string
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    base_price: '',
    stock_quantity: '',
    category: '베이글',
    status: 'active'
  })
  
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchProduct()
  }, [productId])

  const fetchProduct = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single()

      if (error) throw error

      if (data) {
        setProduct(data)
        setFormData({
          name: data.name,
          base_price: data.base_price.toString(),
          stock_quantity: data.stock_quantity.toString(),
          category: data.category || '베이글',
          status: data.status
        })
      }
    } catch (error) {
      console.error('Error fetching product:', error)
      alert('상품 정보를 불러오는 중 오류가 발생했습니다.')
      router.push('/products')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!product) return
    
    setSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('사용자 정보를 찾을 수 없습니다.')

      // 직접 상품 정보 업데이트 (승인 불필요)
      const { error } = await supabase
        .from('products')
        .update({
          name: formData.name,
          base_price: parseFloat(formData.base_price),
          stock_quantity: parseInt(formData.stock_quantity),
          category: formData.category,
          status: formData.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', product.id)

      if (error) throw error

      // 수정 이력 기록 (참고용)
      await supabase
        .from('product_changes')
        .insert({
          product_id: product.id,
          change_type: 'update',
          old_values: {
            name: product.name,
            base_price: product.base_price,
            stock_quantity: product.stock_quantity,
            category: product.category,
            status: product.status
          },
          new_values: {
            name: formData.name,
            base_price: parseFloat(formData.base_price),
            stock_quantity: parseInt(formData.stock_quantity),
            category: formData.category,
            status: formData.status
          },
          change_reason: '상품 정보 수정',
          requested_by: user.id,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          status: 'approved'
        })

      alert('상품 정보가 성공적으로 수정되었습니다.')
      router.push('/products')
    } catch (error) {
      console.error('Error updating product:', error)
      alert('상품 수정 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-bagel-yellow"></div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          상품을 찾을 수 없습니다.
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Link href="/products">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            상품 목록으로
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-black">상품 수정</h1>
        <p className="text-black mt-2">상품 정보를 수정합니다.</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-black mb-2">
              상품명
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-black mb-2">
              카테고리
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow"
            >
              <option value="베이글">베이글</option>
              <option value="음료">음료</option>
              <option value="스프레드">스프레드</option>
              <option value="기타">기타</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-black mb-2">
              기본 가격
            </label>
            <input
              type="number"
              value={formData.base_price}
              onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
              required
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-black mb-2">
              재고 수량
            </label>
            <input
              type="number"
              value={formData.stock_quantity}
              onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
              required
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-black mb-2">
              상태
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow"
            >
              <option value="active">활성</option>
              <option value="inactive">비활성</option>
            </select>
          </div>

          <div className="flex justify-end gap-2">
            <Link href="/products">
              <Button type="button" variant="outline">
                취소
              </Button>
            </Link>
            <Button type="submit" disabled={saving}>
              {saving ? '저장 중...' : '확인'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}