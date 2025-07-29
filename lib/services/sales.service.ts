import { 
  SaleRecord, 
  CreateSaleRequest, 
  SalesListResponse,
  SalesSummaryResponse,
  PopularProduct,
  PaymentMethod 
} from '@/types/sales'

export class SalesService {
  private baseUrl = '/api/sales'

  // 판매 기록 생성
  async createSale(data: CreateSaleRequest): Promise<{ success: boolean; data?: SaleRecord; error?: string }> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '판매 기록 생성 실패')
      }

      return result
    } catch (error) {
      console.error('Create sale error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '판매 기록 생성 중 오류가 발생했습니다.'
      }
    }
  }

  // 판매 기록 목록 조회
  async getSales(params?: {
    start_date?: string
    end_date?: string
    store_id?: string
    payment_method?: PaymentMethod
    limit?: number
    offset?: number
  }): Promise<SalesListResponse> {
    try {
      const queryParams = new URLSearchParams()
      
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            queryParams.append(key, value.toString())
          }
        })
      }

      const response = await fetch(`${this.baseUrl}?${queryParams}`)
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '판매 기록 조회 실패')
      }

      const result = await response.json()
      return result
    } catch (error) {
      console.error('Get sales error:', error)
      return {
        data: [],
        pagination: {
          total: 0,
          limit: 50,
          offset: 0,
          hasMore: false
        }
      }
    }
  }

  // 특정 판매 기록 조회
  async getSale(id: string): Promise<{ success: boolean; data?: SaleRecord; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/${id}`)
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '판매 기록 조회 실패')
      }

      return await response.json()
    } catch (error) {
      console.error('Get sale error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '판매 기록 조회 중 오류가 발생했습니다.'
      }
    }
  }

  // 판매 취소
  async cancelSale(id: string, reason?: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '판매 취소 실패')
      }

      return result
    } catch (error) {
      console.error('Cancel sale error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '판매 취소 중 오류가 발생했습니다.'
      }
    }
  }

  // 매출 요약 정보 조회
  async getSalesSummary(params?: {
    store_id?: string
    start_date?: string
    end_date?: string
    group_by?: 'day' | 'week' | 'month'
  }): Promise<{ success: boolean; data?: SalesSummaryResponse; error?: string }> {
    try {
      const queryParams = new URLSearchParams()
      
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            queryParams.append(key, value.toString())
          }
        })
      }

      const response = await fetch(`${this.baseUrl}/summary?${queryParams}`)
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '매출 요약 조회 실패')
      }

      return await response.json()
    } catch (error) {
      console.error('Get sales summary error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '매출 요약 조회 중 오류가 발생했습니다.'
      }
    }
  }

  // 인기 상품 조회
  async getPopularProducts(params?: {
    store_id?: string
    category_id?: string
    period?: 'day' | 'week' | 'month' | 'all'
    limit?: number
  }): Promise<{ success: boolean; data?: PopularProduct[]; error?: string }> {
    try {
      const queryParams = new URLSearchParams()
      
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            queryParams.append(key, value.toString())
          }
        })
      }

      const response = await fetch(`${this.baseUrl}/popular-products?${queryParams}`)
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '인기 상품 조회 실패')
      }

      return await response.json()
    } catch (error) {
      console.error('Get popular products error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '인기 상품 조회 중 오류가 발생했습니다.'
      }
    }
  }

  // 날짜 포맷 헬퍼
  formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toISOString().split('T')[0]
  }

  // 금액 포맷 헬퍼
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(amount)
  }

  // 결제 방법 라벨
  getPaymentMethodLabel(method: PaymentMethod): string {
    const labels: Record<PaymentMethod, string> = {
      cash: '현금',
      card: '카드',
      transfer: '계좌이체',
      mobile: '모바일결제',
      other: '기타'
    }
    return labels[method] || method
  }
}

// 싱글톤 인스턴스
export const salesService = new SalesService()