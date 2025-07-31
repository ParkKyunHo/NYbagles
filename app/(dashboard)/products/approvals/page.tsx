'use client'

import { useState, useEffect } from 'react'
import { createClientWithAuth } from '@/lib/supabase/client-auth'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Check, X, Eye, Clock, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface ProductChange {
  id: string
  product_id: string
  change_type: 'create' | 'update' | 'delete' | 'price_change' | 'stock_adjustment'
  old_values: any
  new_values: any
  change_reason: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  requested_at: string
  requested_by: string
  reviewed_by?: string
  reviewed_at?: string
  review_comment?: string
  product: {
    id: string
    sku: string
    name: string
    store_id: string
    store?: {
      name: string
    }
  }
  requester?: {
    email: string
    profiles?: {
      full_name: string
    }
  }
}

export default function ProductApprovalsPage() {
  const [changes, setChanges] = useState<ProductChange[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [selectedChange, setSelectedChange] = useState<ProductChange | null>(null)
  const [reviewComment, setReviewComment] = useState('')
  const [userRole, setUserRole] = useState<string>('')
  const [storeId, setStoreId] = useState<string | null>(null)
  
  const router = useRouter()
  const supabase = createClientWithAuth()

  useEffect(() => {
    initializePage()
  }, [filter])

  const initializePage = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Get user role and store
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile) {
        setUserRole(profile.role)
      }

      // Only managers and above can access this page
      if (!['super_admin', 'admin', 'manager'].includes(profile?.role || '')) {
        router.push('/dashboard')
        return
      }

      // Get user's store if manager
      if (profile?.role === 'manager') {
        const { data: employee } = await supabase
          .from('employees')
          .select('store_id')
          .eq('user_id', user.id)
          .single()

        if (employee) {
          setStoreId(employee.store_id)
        }
      }

      await fetchChanges()
    } catch (error) {
      console.error('Error initializing page:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchChanges = async () => {
    try {
      let query = supabase
        .from('product_changes')
        .select(`
          *,
          product:products_v3(
            id,
            sku,
            name,
            store_id,
            store:stores(name)
          ),
          requester:requested_by(
            email,
            profiles:profiles(full_name)
          )
        `)
        .order('requested_at', { ascending: false })

      // Apply filter
      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      // For managers, only show their store's changes
      if (userRole === 'manager' && storeId) {
        query = query.eq('product.store_id', storeId)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching changes:', error)
        alert('변경 요청을 불러오는 중 오류가 발생했습니다.')
      } else {
        setChanges(data || [])
      }
    } catch (error) {
      console.error('Error fetching changes:', error)
    }
  }

  const handleApprove = async (changeId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { error } = await supabase
        .from('product_changes')
        .update({
          status: 'approved',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          review_comment: reviewComment || null
        })
        .eq('id', changeId)

      if (error) {
        alert('승인 처리 중 오류가 발생했습니다.')
      } else {
        alert('승인되었습니다.')
        setSelectedChange(null)
        setReviewComment('')
        await fetchChanges()
      }
    } catch (error) {
      console.error('Error approving change:', error)
      alert('승인 처리 중 오류가 발생했습니다.')
    }
  }

  const handleReject = async (changeId: string) => {
    if (!reviewComment.trim()) {
      alert('거절 사유를 입력해주세요.')
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { error } = await supabase
        .from('product_changes')
        .update({
          status: 'rejected',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          review_comment: reviewComment
        })
        .eq('id', changeId)

      if (error) {
        alert('거절 처리 중 오류가 발생했습니다.')
      } else {
        alert('거절되었습니다.')
        setSelectedChange(null)
        setReviewComment('')
        await fetchChanges()
      }
    } catch (error) {
      console.error('Error rejecting change:', error)
      alert('거절 처리 중 오류가 발생했습니다.')
    }
  }

  const getChangeTypeLabel = (type: string) => {
    switch (type) {
      case 'create': return '신규 등록'
      case 'update': return '정보 수정'
      case 'delete': return '삭제'
      case 'price_change': return '가격 변경'
      case 'stock_adjustment': return '재고 조정'
      default: return type
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">대기중</span>
      case 'approved':
        return <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">승인됨</span>
      case 'rejected':
        return <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">거절됨</span>
      case 'cancelled':
        return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">취소됨</span>
      default:
        return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">{status}</span>
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
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">상품 변경 승인 관리</h1>
        <p className="text-gray-600">상품 등록 및 변경 요청을 검토하고 승인합니다.</p>
      </div>

      {/* Filter tabs */}
      <div className="mb-6 flex gap-2">
        <Button
          variant={filter === 'all' ? 'primary' : 'outline'}
          onClick={() => setFilter('all')}
          size="sm"
        >
          전체
        </Button>
        <Button
          variant={filter === 'pending' ? 'primary' : 'outline'}
          onClick={() => setFilter('pending')}
          size="sm"
        >
          <Clock className="w-4 h-4 mr-1" />
          대기중
        </Button>
        <Button
          variant={filter === 'approved' ? 'primary' : 'outline'}
          onClick={() => setFilter('approved')}
          size="sm"
        >
          <Check className="w-4 h-4 mr-1" />
          승인됨
        </Button>
        <Button
          variant={filter === 'rejected' ? 'primary' : 'outline'}
          onClick={() => setFilter('rejected')}
          size="sm"
        >
          <X className="w-4 h-4 mr-1" />
          거절됨
        </Button>
      </div>

      {/* Changes list */}
      <div className="space-y-4">
        {changes.map(change => (
          <Card key={change.id} className="p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold">{change.product?.name || '알 수 없는 상품'}</h3>
                  {getStatusBadge(change.status)}
                  <span className="text-sm text-gray-500">
                    {getChangeTypeLabel(change.change_type)}
                  </span>
                </div>
                
                <div className="text-sm text-gray-600 space-y-1">
                  <p>매장: {change.product?.store?.name || '알 수 없음'}</p>
                  <p>요청자: {change.requester?.profiles?.full_name || change.requester?.email || '알 수 없음'}</p>
                  <p>요청일: {new Date(change.requested_at).toLocaleString()}</p>
                  {change.change_reason && (
                    <p>사유: {change.change_reason}</p>
                  )}
                  {change.reviewed_at && (
                    <>
                      <p>검토일: {new Date(change.reviewed_at).toLocaleString()}</p>
                      {change.review_comment && (
                        <p>검토 의견: {change.review_comment}</p>
                      )}
                    </>
                  )}
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedChange(change)}
                >
                  <Eye className="w-4 h-4" />
                  상세보기
                </Button>
                {change.status === 'pending' && (
                  <>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleApprove(change.id)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="w-4 h-4" />
                      승인
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        setSelectedChange(change)
                        setReviewComment('')
                      }}
                    >
                      <X className="w-4 h-4" />
                      거절
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {changes.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <AlertCircle className="w-12 h-12 mx-auto mb-3" />
          <p>표시할 변경 요청이 없습니다.</p>
        </div>
      )}

      {/* Detail/Review Modal */}
      {selectedChange && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">변경 상세 정보</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">기본 정보</h3>
                <div className="bg-gray-50 p-3 rounded space-y-1 text-sm">
                  <p><strong>상품명:</strong> {selectedChange.product?.name}</p>
                  <p><strong>SKU:</strong> {selectedChange.product?.sku}</p>
                  <p><strong>매장:</strong> {selectedChange.product?.store?.name}</p>
                  <p><strong>변경 유형:</strong> {getChangeTypeLabel(selectedChange.change_type)}</p>
                  <p><strong>요청자:</strong> {selectedChange.requester?.profiles?.full_name || selectedChange.requester?.email}</p>
                  <p><strong>요청일:</strong> {new Date(selectedChange.requested_at).toLocaleString()}</p>
                  <p><strong>사유:</strong> {selectedChange.change_reason || '없음'}</p>
                </div>
              </div>

              {selectedChange.change_type === 'update' && selectedChange.old_values && (
                <div>
                  <h3 className="font-semibold mb-2">변경 내용</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-red-50 p-3 rounded">
                      <h4 className="font-medium mb-2 text-red-700">이전 값</h4>
                      <pre className="text-sm">{JSON.stringify(selectedChange.old_values, null, 2)}</pre>
                    </div>
                    <div className="bg-green-50 p-3 rounded">
                      <h4 className="font-medium mb-2 text-green-700">새로운 값</h4>
                      <pre className="text-sm">{JSON.stringify(selectedChange.new_values, null, 2)}</pre>
                    </div>
                  </div>
                </div>
              )}

              {selectedChange.change_type !== 'update' && selectedChange.new_values && (
                <div>
                  <h3 className="font-semibold mb-2">상품 정보</h3>
                  <div className="bg-gray-50 p-3 rounded">
                    <pre className="text-sm">{JSON.stringify(selectedChange.new_values, null, 2)}</pre>
                  </div>
                </div>
              )}

              {selectedChange.status === 'pending' && (
                <div>
                  <h3 className="font-semibold mb-2">검토 의견</h3>
                  <textarea
                    className="w-full px-3 py-2 border rounded-md"
                    rows={3}
                    placeholder="승인/거절 사유를 입력하세요 (거절 시 필수)"
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                  />
                </div>
              )}

              <div className="flex gap-2 pt-4">
                {selectedChange.status === 'pending' && (
                  <>
                    <Button
                      onClick={() => handleApprove(selectedChange.id)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      승인
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => handleReject(selectedChange.id)}
                    >
                      <X className="w-4 h-4 mr-2" />
                      거절
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedChange(null)
                    setReviewComment('')
                  }}
                >
                  닫기
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}