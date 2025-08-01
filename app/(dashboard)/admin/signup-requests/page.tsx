'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Building2, Edit2 } from 'lucide-react'

interface SignupRequest {
  id: string
  email: string
  full_name: string
  phone: string | null
  store_id: string | null
  store_code: string | null
  verification_code: string | null
  verified: boolean
  verified_at: string | null
  approved: boolean
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  status: string
  expires_at: string
  created_at: string
  password_hash: string | null
  stores?: {
    id: string
    name: string
    code: string
  }
}

interface Store {
  id: string
  name: string
  code: string
  is_active: boolean
}

export default function SignupRequestsPage() {
  const [requests, setRequests] = useState<SignupRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState('verified')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [stores, setStores] = useState<Store[]>([])
  const [showStoreModal, setShowStoreModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<SignupRequest | null>(null)
  const [newStoreId, setNewStoreId] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const checkAuth = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/login')
      return
    }

    // 권한 확인
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['super_admin', 'admin', 'manager'].includes(profile.role)) {
      router.push('/dashboard')
    }
  }, [router, supabase])

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    
    try {
      const response = await fetch(`/api/admin/signup-requests?status=${selectedStatus}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch requests')
      }
      
      const data = await response.json()
      setRequests(data.requests || [])
    } catch (error) {
      console.error('Error fetching signup requests:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedStatus])

  const fetchStores = useCallback(async () => {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (data && !error) {
      setStores(data)
    }
  }, [supabase])

  useEffect(() => {
    checkAuth()
    fetchRequests()
    fetchStores()
  }, [selectedStatus, checkAuth, fetchRequests, fetchStores])

  const handleApprove = async (requestId: string) => {
    if (!confirm('이 직원의 가입을 승인하시겠습니까?')) {
      return
    }

    setProcessingId(requestId)

    try {
      const response = await fetch(`/api/admin/signup-requests/${requestId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'employee' }),
      })

      if (!response.ok) {
        throw new Error('Failed to approve request')
      }

      alert('직원 가입이 승인되었습니다. 직원에게 비밀번호 설정 이메일이 발송됩니다.')
      fetchRequests()
    } catch (error) {
      console.error('Error approving request:', error)
      alert('승인 처리 중 오류가 발생했습니다.')
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (requestId: string) => {
    const reason = prompt('거절 사유를 입력해주세요:')
    
    if (!reason) {
      return
    }

    setProcessingId(requestId)

    try {
      const response = await fetch(`/api/admin/signup-requests/${requestId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      })

      if (!response.ok) {
        throw new Error('Failed to reject request')
      }

      alert('가입 요청이 거절되었습니다.')
      fetchRequests()
    } catch (error) {
      console.error('Error rejecting request:', error)
      alert('거절 처리 중 오류가 발생했습니다.')
    } finally {
      setProcessingId(null)
    }
  }

  const handleChangeStore = (request: SignupRequest) => {
    setSelectedRequest(request)
    setNewStoreId(request.store_id || '')
    setShowStoreModal(true)
  }

  const handleUpdateStore = async () => {
    if (!selectedRequest || !newStoreId) return

    try {
      const { error } = await supabase
        .from('employee_signup_requests')
        .update({ 
          store_id: newStoreId,
          store_code: stores.find(s => s.id === newStoreId)?.code || ''
        })
        .eq('id', selectedRequest.id)

      if (error) throw error

      alert('매장이 변경되었습니다.')
      setShowStoreModal(false)
      fetchRequests()
    } catch (error) {
      console.error('Error updating store:', error)
      alert('매장 변경 중 오류가 발생했습니다.')
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { text: '대기중', class: 'bg-yellow-100 text-yellow-800' },
      approved: { text: '승인됨', class: 'bg-green-100 text-green-800' },
      rejected: { text: '거절됨', class: 'bg-red-100 text-red-800' },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.class}`}>
        {config.text}
      </span>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">직원 가입 요청 관리</h1>
        <p className="text-gray-600 mt-2">직원들의 가입 요청을 검토하고 승인하세요.</p>
      </div>

      {/* 상태 필터 */}
      <div className="mb-6 flex gap-2">
        <Button
          variant={selectedStatus === 'pending' ? 'primary' : 'ghost'}
          onClick={() => setSelectedStatus('pending')}
        >
          대기중
        </Button>
        <Button
          variant={selectedStatus === 'approved' ? 'primary' : 'ghost'}
          onClick={() => setSelectedStatus('approved')}
        >
          승인됨
        </Button>
        <Button
          variant={selectedStatus === 'rejected' ? 'primary' : 'ghost'}
          onClick={() => setSelectedStatus('rejected')}
        >
          거절됨
        </Button>
      </div>

      {/* 요청 목록 */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bagel-yellow mx-auto"></div>
            <p className="mt-4 text-gray-600">로딩 중...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-600">
              {selectedStatus === 'pending' && '대기 중인 가입 요청이 없습니다.'}
              {selectedStatus === 'approved' && '승인된 가입 요청이 없습니다.'}
              {selectedStatus === 'rejected' && '거절된 가입 요청이 없습니다.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    직원 정보
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    매장
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    전화번호
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    신청일
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {request.full_name}
                        </div>
                        <div className="text-sm text-gray-700">
                          {request.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-gray-900">
                            {request.stores?.name || '알 수 없음'}
                          </div>
                          <div className="text-sm text-gray-700">
                            코드: {request.store_code}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleChangeStore(request)}
                          className="ml-2"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {request.phone || '전화번호 없음'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {formatDistanceToNow(new Date(request.created_at), {
                        addSuffix: true,
                        locale: ko,
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusBadge(request.status)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {(request.status === 'verified' || request.status === 'pending') && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleApprove(request.id)}
                            disabled={processingId === request.id}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            승인
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleReject(request.id)}
                            disabled={processingId === request.id}
                            className="bg-red-600 hover:bg-red-700 text-white"
                          >
                            거절
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 매장 변경 모달 */}
      {showStoreModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              매장 변경
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              {selectedRequest.full_name} 님의 소속 매장을 변경합니다.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                변경할 매장
              </label>
              <div className="relative">
                <select
                  value={newStoreId}
                  onChange={(e) => setNewStoreId(e.target.value)}
                  className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent appearance-none"
                >
                  <option value="">매장을 선택하세요</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name} ({store.code})
                    </option>
                  ))}
                </select>
                <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-600" />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowStoreModal(false)
                  setSelectedRequest(null)
                  setNewStoreId('')
                }}
              >
                취소
              </Button>
              <Button
                onClick={handleUpdateStore}
                disabled={!newStoreId || newStoreId === selectedRequest.store_id}
                className="bg-bagel-yellow hover:bg-yellow-600 text-black"
              >
                변경하기
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}