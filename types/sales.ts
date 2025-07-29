export interface SaleRecord {
  id: string
  store_id: string
  product_id?: string | null
  quantity: number
  unit_price: number
  total_amount: number
  recorded_by: string
  sale_date: string
  sale_time: string
  payment_method: PaymentMethod
  notes?: string | null
  is_canceled: boolean
  canceled_at?: string | null
  canceled_by?: string | null
  created_at: string
  
  // Relations
  sales_items?: SaleItem[]
  stores?: Store
  profiles?: Profile
  canceled_by_profile?: Profile
}

export interface SaleItem {
  id: string
  sale_id: string
  product_id: string
  quantity: number
  unit_price: number
  total_amount: number
  discount_amount: number
  created_at: string
  
  // Relations
  products?: Product
}

export interface Product {
  id: string
  name: string
  description?: string | null
  sku?: string | null
  category_id: string
  price: number
  unit: string
  display_order?: number | null
  is_active: boolean
  created_at: string
  updated_at: string
  stock_quantity?: number
  
  // Relations
  product_categories?: ProductCategory
  store_products?: StoreProduct[]
}

export interface StoreProduct {
  store_id: string
  product_id: string
  custom_price?: number | null
  is_available: boolean
  stock_quantity: number
}

export interface ProductCategory {
  id: string
  name: string
  description?: string | null
  display_order: number
  is_active: boolean
  created_at: string
}

export interface Store {
  id: string
  name: string
  code: string
  category_id: string
  region_id: string
  address?: string | null
  phone?: string | null
  opening_time?: string | null
  closing_time?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  name?: string | null
  email?: string | null
  role: UserRole
}

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'mobile' | 'other'
export type UserRole = 'super_admin' | 'admin' | 'manager' | 'employee' | 'part_time'

export interface CreateSaleRequest {
  items: CreateSaleItem[]
  payment_method: PaymentMethod
  notes?: string
}

export interface CreateSaleItem {
  product_id: string
  quantity: number
  unit_price: number
  discount_amount?: number
}

export interface DailySalesSummary {
  id: string
  store_id: string
  sale_date: string
  total_sales: number
  cash_sales: number
  card_sales: number
  other_sales: number
  transaction_count: number
  canceled_count: number
  created_at: string
  updated_at: string
  
  // Relations
  stores?: Store
}

export interface SalesSummaryResponse {
  summaries: DailySalesSummary[] | AggregatedSummary[]
  total_stats: {
    total_sales: number
    cash_sales: number
    card_sales: number
    other_sales: number
    transaction_count: number
    canceled_count: number
    days: number
    daily_average: number
    transaction_average: number
  }
  period: {
    start_date: string
    end_date: string
    group_by: 'day' | 'week' | 'month'
  }
}

export interface AggregatedSummary {
  period: string
  total_sales: number
  cash_sales: number
  card_sales: number
  other_sales: number
  transaction_count: number
  canceled_count: number
  days: number
  stores?: Store
}

export interface PopularProduct {
  product_id: string
  product_name: string
  category_id: string
  category_name: string
  unit: string
  default_price: number
  total_quantity: number
  total_revenue: number
  transaction_count: number
  avg_price: number
}

export interface SalesListResponse {
  data: SaleRecord[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}