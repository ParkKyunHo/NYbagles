'use client'

import { useState, useEffect } from 'react'
import { createClientWithAuth } from '@/lib/supabase/client-auth'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Calendar, Package, DollarSign, TrendingUp } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface ProductSales {
  product_id: string
  product_name: string
  opening_stock: number
  current_stock: number
  quantity_sold: number
  revenue: number
}

interface SalesByHour {
  hour: number
  count: number
  revenue: number
}

export default function DailyClosingPage() {
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [storeName, setStoreName] = useState<string>('')
  const [todayDate, setTodayDate] = useState('')
  const [todayTotal, setTodayTotal] = useState(0)
  const [productSales, setProductSales] = useState<ProductSales[]>([])
  const [hourlyData, setHourlyData] = useState<SalesByHour[]>([])
  const [alreadyClosed, setAlreadyClosed] = useState(false)
  
  const router = useRouter()
  const supabase = createClientWithAuth()

  useEffect(() => {
    const today = new Date()
    setTodayDate(today.toLocaleDateString('ko-KR'))
    initializePage()
  }, [])

  const initializePage = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Get user's store
      const { data: employee } = await supabase
        .from('employees')
        .select('store_id, stores(id, name)')
        .eq('user_id', user.id)
        .single()

      if (employee?.store_id) {
        setStoreId(employee.store_id)
        setStoreName(employee.stores?.name || '')
        await checkClosingStatus(employee.store_id)
        await fetchTodayData(employee.store_id)
      } else {
        // For admin, get first store
        const { data: firstStore } = await supabase
          .from('stores')
          .select('id, name')
          .limit(1)
          .single()

        if (firstStore) {
          setStoreId(firstStore.id)
          setStoreName(firstStore.name)
          await checkClosingStatus(firstStore.id)
          await fetchTodayData(firstStore.id)
        }
      }
    } catch (error) {
      console.error('Error initializing page:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkClosingStatus = async (storeId: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const { data } = await supabase
      .from('daily_closing')
      .select('id')
      .eq('store_id', storeId)
      .eq('closing_date', today.toISOString().split('T')[0])
      .limit(1)

    setAlreadyClosed(data && data.length > 0)
  }

  const fetchTodayData = async (storeId: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    try {
      // Fetch today's sales from new table first
      let salesData: any[] = []
      let { data: newSales, error: newError } = await supabase
        .from('sales')
        .select('*, products_v2(name, stock_quantity)')
        .eq('store_id', storeId)
        .gte('sold_at', today.toISOString())
        .lt('sold_at', tomorrow.toISOString())

      if (!newError && newSales && newSales.length > 0) {
        salesData = newSales
      } else {
        // Fallback to old sales_records
        const { data: oldSales } = await supabase
          .from('sales_records')
          .select('*')
          .eq('store_id', storeId)
          .gte('created_at', today.toISOString())
          .lt('created_at', tomorrow.toISOString())

        if (oldSales) {
          salesData = oldSales.map(sale => ({
            ...sale,
            quantity: 1,
            unit_price: sale.total_amount,
            sold_at: sale.created_at
          }))
        }
      }

      // Calculate total revenue
      const total = salesData.reduce((sum, sale) => sum + Number(sale.total_amount), 0)
      setTodayTotal(total)

      // Calculate product sales summary
      const productMap = new Map<string, ProductSales>()
      
      for (const sale of salesData) {
        if (sale.product_id) {
          const existing = productMap.get(sale.product_id) || {
            product_id: sale.product_id,
            product_name: sale.products_v2?.name || 'Unknown Product',
            opening_stock: 0,
            current_stock: sale.products_v2?.stock_quantity || 0,
            quantity_sold: 0,
            revenue: 0
          }
          
          existing.quantity_sold += sale.quantity || 1
          existing.revenue += Number(sale.total_amount)
          existing.opening_stock = existing.current_stock + existing.quantity_sold
          
          productMap.set(sale.product_id, existing)
        }
      }

      // Get all products to include those with no sales
      const { data: allProducts } = await supabase
        .from('products_v2')
        .select('*')
        .eq('store_id', storeId)
        .eq('is_active', true)

      if (allProducts) {
        for (const product of allProducts) {
          if (!productMap.has(product.id)) {
            productMap.set(product.id, {
              product_id: product.id,
              product_name: product.name,
              opening_stock: product.stock_quantity,
              current_stock: product.stock_quantity,
              quantity_sold: 0,
              revenue: 0
            })
          }
        }
      }

      setProductSales(Array.from(productMap.values()))

      // Calculate hourly distribution
      const hourlyMap = new Map<number, SalesByHour>()
      
      for (const sale of salesData) {
        const hour = new Date(sale.sold_at || sale.created_at).getHours()
        const existing = hourlyMap.get(hour) || { hour, count: 0, revenue: 0 }
        existing.count += 1
        existing.revenue += Number(sale.total_amount)
        hourlyMap.set(hour, existing)
      }

      // Fill in missing hours
      for (let hour = 9; hour <= 21; hour++) {
        if (!hourlyMap.has(hour)) {
          hourlyMap.set(hour, { hour, count: 0, revenue: 0 })
        }
      }

      setHourlyData(Array.from(hourlyMap.values()).sort((a, b) => a.hour - b.hour))
      
    } catch (error) {
      console.error('Error fetching today data:', error)
    }
  }

  const processClosing = async () => {
    if (!storeId || alreadyClosed) return
    
    setClosing(true)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const today = new Date().toISOString().split('T')[0]

      // Save closing data for each product
      for (const product of productSales) {
        await supabase
          .from('daily_closing')
          .insert({
            store_id: storeId,
            closing_date: today,
            product_id: product.product_id,
            opening_stock: product.opening_stock,
            closing_stock: product.current_stock,
            total_sold: product.quantity_sold,
            total_revenue: product.revenue,
            closed_by: user.id
          })
      }

      setAlreadyClosed(true)
      alert('일일 마감이 완료되었습니다!')
      
    } catch (error) {
      console.error('Error processing closing:', error)
      alert('마감 처리 중 오류가 발생했습니다')
    } finally {
      setClosing(false)
    }
  }

  const getMaxRevenue = () => {
    return Math.max(...hourlyData.map(h => h.revenue), 1)
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
        <h1 className="text-2xl font-bold mb-2">일일 마감</h1>
        <p className="text-gray-600">{storeName} - {todayDate}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">오늘 매출</p>
              <p className="text-2xl font-bold">₩{todayTotal.toLocaleString()}</p>
            </div>
            <DollarSign className="w-8 h-8 text-gray-400" />
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">판매 수량</p>
              <p className="text-2xl font-bold">
                {productSales.reduce((sum, p) => sum + p.quantity_sold, 0)}개
              </p>
            </div>
            <Package className="w-8 h-8 text-gray-400" />
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">베스트셀러</p>
              <p className="text-2xl font-bold">
                {productSales.length > 0 
                  ? productSales.sort((a, b) => b.quantity_sold - a.quantity_sold)[0].product_name
                  : '-'}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-gray-400" />
          </div>
        </Card>
      </div>

      {/* Hourly Sales Chart */}
      <Card className="p-4 mb-6">
        <h2 className="text-lg font-semibold mb-4">시간대별 매출</h2>
        <div className="space-y-2">
          {hourlyData.map(hour => (
            <div key={hour.hour} className="flex items-center gap-3">
              <span className="text-sm w-12">{hour.hour}시</span>
              <div className="flex-1 bg-gray-200 rounded-full h-6 relative overflow-hidden">
                <div 
                  className="absolute left-0 top-0 h-full bg-bagel-yellow rounded-full transition-all duration-500"
                  style={{ width: `${(hour.revenue / getMaxRevenue()) * 100}%` }}
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-medium">
                  ₩{hour.revenue.toLocaleString()} ({hour.count}건)
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Product Sales Details */}
      <Card className="p-4 mb-6">
        <h2 className="text-lg font-semibold mb-4">상품별 판매 현황</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">상품명</th>
                <th className="text-right py-2">시작 재고</th>
                <th className="text-right py-2">판매 수량</th>
                <th className="text-right py-2">현재 재고</th>
                <th className="text-right py-2">매출액</th>
              </tr>
            </thead>
            <tbody>
              {productSales.map(product => (
                <tr key={product.product_id} className="border-b">
                  <td className="py-2">{product.product_name}</td>
                  <td className="text-right py-2">{product.opening_stock}개</td>
                  <td className="text-right py-2 font-semibold">{product.quantity_sold}개</td>
                  <td className="text-right py-2">{product.current_stock}개</td>
                  <td className="text-right py-2">₩{product.revenue.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="pt-2">합계</td>
                <td className="text-right pt-2">-</td>
                <td className="text-right pt-2">
                  {productSales.reduce((sum, p) => sum + p.quantity_sold, 0)}개
                </td>
                <td className="text-right pt-2">-</td>
                <td className="text-right pt-2">₩{todayTotal.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Closing Button */}
      <div className="text-center">
        {alreadyClosed ? (
          <div className="text-gray-600">
            <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p>오늘 마감이 완료되었습니다.</p>
          </div>
        ) : (
          <Button 
            size="lg"
            onClick={processClosing}
            disabled={closing}
          >
            {closing ? '마감 처리 중...' : '일일 마감하기'}
          </Button>
        )}
      </div>
    </div>
  )
}