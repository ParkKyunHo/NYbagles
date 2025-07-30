'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { 
  UserPlus, 
  CheckCircle, 
  XCircle,
  Clock,
  Building2,
  Mail,
  User,
  Phone
} from 'lucide-react'
import { Button } from '@/components/ui/button'

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
  stores?: {
    id: string
    name: string
    code: string
    store_categories?: {
      name: string
      regions?: {
        name: string
      }
    }
  }
}

export default function EmployeeRequestsPage() {
  const [requests, setRequests] = useState<SignupRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState('verified')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string>('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkAuthAndLoadData()
  }, [selectedStatus])

  const checkAuthAndLoadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/login')
      return
    }

    // 사용자 정보 및 권한 확인
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['super_admin', 'admin', 'manager'].includes(profile.role)) {
      router.push('/dashboard')
      return
    }

    setUserRole(profile.role)
    fetchRequests()
  }

  const fetchRequests = async () => {
    setLoading(true)
    
    try {
      let query = supabase
        .from('employee_signup_requests')
        .select(`
          *,
          stores (
            id,
            name,
            code,
            store_categories (
              name,
              regions (
                name
              )
            )
          )
        `)
        .eq('status', selectedStatus)
        .order('created_at', { ascending: false })

      const { data, error } = await query

      if (error) throw error
      
      setRequests(data || [])
    } catch (error) {
      console.error('Error fetching signup requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (requestId: string, request: SignupRequest) => {
    if (!confirm(`${request.full_name}님의 가입을 승인하시겠습니까?`)) {
      return
    }

    setProcessingId(requestId)

    try {
      // Call the database function to process the signup
      const { data, error } = await supabase
        .rpc('process_employee_signup', {
          p_request_id: requestId,
          p_approved: true,
          p_role: 'employee'
        })

      if (error) throw error

      // Update the request status locally
      const { error: updateError } = await supabase
        .from('employee_signup_requests')
        .update({
          approved: true,
          approved_by: (await supabase.auth.getUser()).data.user?.id,
          approved_at: new Date().toISOString(),
          status: 'approved'
        })
        .eq('id', requestId)

      if (updateError) throw updateError

      alert(`승인 완료!\n관리자가 직접 Supabase 대시보드에서 사용자 계정을 생성해주세요.\n이메일: ${request.email}`)

      fetchRequests()
    } catch (error) {
      console.error('Error approving request:', error)
      alert('승인 처리 중 오류가 발생했습니다.')
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (requestId: string, request: SignupRequest) => {
    const reason = prompt(`${request.full_name}님의 가입을 거절하는 이유를 입력하세요:`)
    
    if (!reason) return

    setProcessingId(requestId)

    try {
      const { error } = await supabase
        .from('employee_signup_requests')
        .update({
          approved: false,
          approved_by: (await supabase.auth.getUser()).data.user?.id,
          approved_at: new Date().toISOString(),
          rejection_reason: reason,
          status: 'rejected'
        })
        .eq('id', requestId)

      if (error) throw error

      fetchRequests()
    } catch (error) {
      console.error('Error rejecting request:', error)
      alert('거절 처리 중 오류가 발생했습니다.')
    } finally {
      setProcessingId(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">대기중</span>
      case 'verified':
        return <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">인증완료</span>
      case 'approved':
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">승인됨</span>
      case 'rejected':
        return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">거절됨</span>
      case 'expired':
        return <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">만료됨</span>
      default:
        return null
    }
  }

  const getLocationDisplay = (request: SignupRequest) => {
    if (!request.stores) return request.store_code || '미지정'
    
    const region = request.stores.store_categories?.regions?.name || ''
    const category = request.stores.store_categories?.name || ''
    
    return `${request.stores.name} (${region} - ${category})`
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center">
          <UserPlus className="mr-3 h-8 w-8 text-bagel-yellow" />
          직원 가입 요청 관리
        </h1>
        <p className="text-gray-600 mt-2">
          신규 직원의 가입 요청을 검토하고 승인/거절할 수 있습니다.
        </p>
      </div>

      {/* Status Filter */}
      <div className="mb-6">
        <div className="flex space-x-2">
          {[
            { value: 'pending', label: '대기중', icon: Clock },
            { value: 'verified', label: '인증완료', icon: CheckCircle },
            { value: 'approved', label: '승인됨', icon: CheckCircle },
            { value: 'rejected', label: '거절됨', icon: XCircle }
          ].map((status) => {
            const Icon = status.icon
            return (
              <button
                key={status.value}
                onClick={() => setSelectedStatus(status.value)}
                className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                  selectedStatus === status.value
                    ? 'bg-bagel-yellow text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {status.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Requests List */}
      {requests.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <UserPlus className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">가입 요청이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <div key={request.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center mb-2">
                    <h3 className="text-lg font-semibold">{request.full_name}</h3>
                    <div className="ml-3">
                      {getStatusBadge(request.status)}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600">
                    <div className="flex items-center">
                      <Mail className="h-4 w-4 mr-2 text-gray-400" />
                      {request.email}
                    </div>
                    {request.phone && (
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 mr-2 text-gray-400" />
                        {request.phone}
                      </div>
                    )}
                    <div className="flex items-center">
                      <Building2 className="h-4 w-4 mr-2 text-gray-400" />
                      {getLocationDisplay(request)}
                    </div>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-2 text-gray-400" />
                      신청일: {format(new Date(request.created_at), 'yyyy년 MM월 dd일 HH:mm', { locale: ko })}
                    </div>
                  </div>

                  {request.rejection_reason && (
                    <div className="mt-3 p-3 bg-red-50 rounded text-sm text-red-700">
                      거절 사유: {request.rejection_reason}
                    </div>
                  )}
                </div>

                {request.status === 'verified' && (
                  <div className="flex space-x-2 ml-4">
                    <Button
                      onClick={() => handleApprove(request.id, request)}
                      disabled={processingId === request.id}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {processingId === request.id ? '처리 중...' : '승인'}
                    </Button>
                    <Button
                      onClick={() => handleReject(request.id, request)}
                      disabled={processingId === request.id}
                      variant="outline"
                      className="text-red-600 border-red-600 hover:bg-red-50"
                    >
                      거절
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}