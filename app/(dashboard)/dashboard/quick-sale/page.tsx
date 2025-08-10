import { requireRole } from '@/lib/auth/unified-auth'
import { createClient } from '@/lib/supabase/server'
import QuickSaleClient from './QuickSaleClient'

export default async function QuickSalePage() {
  // 권한 체크와 사용자 정보 가져오기
  const user = await requireRole(['super_admin', 'admin', 'manager'])
  
  const supabase = await createClient()
  
  // 상품 데이터 가져오기
  const { data: products } = await supabase
    .from('products')
    .select('id, name, base_price, stock_quantity')
    .eq('status', 'active')
    .eq('store_id', user.storeId)
    .order('name')
  
  // 오늘 매출 가져오기
  const today = new Date().toISOString().split('T')[0]
  const { data: sales } = await supabase
    .from('sales_transactions')
    .select('total_amount')
    .eq('store_id', user.storeId)
    .gte('created_at', today)
  
  const todaySales = sales?.reduce((sum, sale) => sum + Number(sale.total_amount), 0) || 0
  
  return (
    <QuickSaleClient 
      initialProducts={products || []}
      initialTodaySales={todaySales}
      storeName={user.storeName || ''}
      storeId={user.storeId || ''}
    />
  )
}