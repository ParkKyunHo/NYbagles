'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Category {
  id: string
  name: string
}

export default function CreateProductPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category_id: '',
    price: '',
    unit: '개',
    display_order: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkAuth()
    fetchCategories()
  }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/login')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
      router.push('/products')
    }
  }

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('product_categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order')

    if (!error && data) {
      setCategories(data)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // 유효성 검사
      if (!formData.name || !formData.category_id || !formData.price) {
        throw new Error('필수 항목을 모두 입력해주세요.')
      }

      const price = parseFloat(formData.price)
      if (isNaN(price) || price <= 0) {
        throw new Error('올바른 가격을 입력해주세요.')
      }

      // 상품 생성
      const { error: insertError } = await supabase
        .from('products')
        .insert({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          category_id: formData.category_id,
          price: price,
          unit: formData.unit,
          display_order: formData.display_order ? parseInt(formData.display_order) : null,
          is_active: true
        })

      if (insertError) throw insertError

      // 성공 메시지 표시
      alert('상품이 성공적으로 추가되었습니다.')
      
      // 약간의 지연 후 리다이렉션 (데이터베이스 동기화를 위해)
      setTimeout(() => {
        router.push('/products')
      }, 500)
    } catch (error: any) {
      console.error('Error creating product:', error)
      setError(error.message || '상품 생성 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">새 상품 추가</h1>
        <p className="text-gray-600 mt-2">상품 카탈로그에 새로운 상품을 추가합니다.</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* 상품명 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            상품명 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow"
            placeholder="예: 플레인 베이글"
            required
          />
        </div>

        {/* 설명 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            설명
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow"
            placeholder="상품에 대한 간단한 설명을 입력하세요"
          />
        </div>


        {/* 카테고리 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            카테고리 <span className="text-red-500">*</span>
          </label>
          <select
            name="category_id"
            value={formData.category_id}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow"
            required
          >
            <option value="">카테고리 선택</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {categories.length === 0 && (
            <p className="mt-2 text-sm text-gray-700">
              카테고리가 없습니다. 상품 관리 페이지에서 카테고리를 먼저 생성해주세요.
            </p>
          )}
        </div>

        {/* 가격과 단위 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              기본 가격 <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-700">
                ₩
              </span>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleChange}
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow"
                placeholder="0"
                step="100"
                min="0"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              단위
            </label>
            <select
              name="unit"
              value={formData.unit}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow"
            >
              <option value="개">개</option>
              <option value="잔">잔</option>
              <option value="세트">세트</option>
              <option value="팩">팩</option>
              <option value="박스">박스</option>
            </select>
          </div>
        </div>

        {/* 표시 순서 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            표시 순서
          </label>
          <input
            type="number"
            name="display_order"
            value={formData.display_order}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow"
            placeholder="숫자가 작을수록 먼저 표시됩니다"
            min="0"
          />
        </div>

        {/* 버튼 */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push('/products')}
          >
            취소
          </Button>
          <Button
            type="submit"
            disabled={loading}
          >
            {loading ? '생성 중...' : '상품 추가'}
          </Button>
        </div>
      </form>
    </div>
  )
}