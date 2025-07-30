'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Plus, Edit2, Trash2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Category {
  id: string
  name: string
  description: string | null
  display_order: number | null
  is_active: boolean
}

interface CategoryManagementModalProps {
  isOpen: boolean
  onClose: () => void
  onCategoryUpdate: () => void
}

export function CategoryManagementModal({ isOpen, onClose, onCategoryUpdate }: CategoryManagementModalProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (isOpen) {
      fetchCategories()
    }
  }, [isOpen])

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('product_categories')
      .select('*')
      .order('display_order')
      .order('name')

    if (!error && data) {
      setCategories(data)
    }
  }

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('product_categories')
        .insert({
          name: newCategoryName.trim(),
          is_active: true
        })

      if (error) throw error

      setNewCategoryName('')
      fetchCategories()
      onCategoryUpdate()
    } catch (error) {
      console.error('Error creating category:', error)
      alert('카테고리 생성 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateCategory = async (id: string) => {
    if (!editingName.trim()) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('product_categories')
        .update({ name: editingName.trim() })
        .eq('id', id)

      if (error) throw error

      setEditingId(null)
      setEditingName('')
      fetchCategories()
      onCategoryUpdate()
    } catch (error) {
      console.error('Error updating category:', error)
      alert('카테고리 수정 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('product_categories')
        .update({ is_active: !currentStatus })
        .eq('id', id)

      if (error) throw error

      fetchCategories()
      onCategoryUpdate()
    } catch (error) {
      console.error('Error toggling category status:', error)
      alert('카테고리 상태 변경 중 오류가 발생했습니다.')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">카테고리 관리</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full"
          >
            <X className="h-5 w-5 text-gray-700" />
          </button>
        </div>

        {/* 새 카테고리 추가 */}
        <div className="mb-4 flex gap-2">
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCreateCategory()}
            placeholder="새 카테고리 이름"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow"
          />
          <Button
            onClick={handleCreateCategory}
            disabled={loading || !newCategoryName.trim()}
            className="flex items-center gap-1"
          >
            <Plus className="h-4 w-4" />
            추가
          </Button>
        </div>

        {/* 카테고리 목록 */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-2 text-gray-700 font-semibold">카테고리명</th>
                <th className="text-center py-2 px-2 text-gray-700 font-semibold">상태</th>
                <th className="text-right py-2 px-2 text-gray-700 font-semibold">작업</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id} className="border-b">
                  <td className="py-2 px-2">
                    {editingId === category.id ? (
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleUpdateCategory(category.id)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900"
                        autoFocus
                      />
                    ) : (
                      <span className={!category.is_active ? 'text-gray-400' : 'text-gray-900 font-medium'}>
                        {category.name}
                      </span>
                    )}
                  </td>
                  <td className="text-center py-2 px-2">
                    <button
                      onClick={() => handleToggleActive(category.id, category.is_active)}
                      className={`px-2 py-1 text-xs rounded font-medium ${
                        category.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {category.is_active ? '활성' : '비활성'}
                    </button>
                  </td>
                  <td className="text-right py-2 px-2">
                    <div className="flex justify-end gap-1">
                      {editingId === category.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleUpdateCategory(category.id)}
                            disabled={loading}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(null)
                              setEditingName('')
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingId(category.id)
                            setEditingName(category.name)
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}