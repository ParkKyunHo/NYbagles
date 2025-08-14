'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  BarChart3, 
  TrendingUp, 
  Calendar,
  DollarSign,
  Package,
  Store
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface SalesData {
  date: string;
  productName: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  paymentMethod: string;
  storeName: string;
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string>('');
  const [stores, setStores] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string>('');
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!profileData || !['super_admin', 'admin', 'manager'].includes(profileData.role)) {
        router.push('/dashboard');
        return;
      }

      setUserRole(profileData.role);

      // Get user's store or all stores for admin
      if (profileData.role === 'super_admin' || profileData.role === 'admin') {
        // Fetch all stores
        const { data: storesData } = await supabase
          .from('stores')
          .select('*')
          .order('name');
        
        if (storesData && storesData.length > 0) {
          setStores(storesData);
          setStoreId(storesData[0].id);
          setStoreName(storesData[0].name);
        }
      } else {
        // Manager - get their store
        const { data: employee } = await supabase
          .from('employees')
          .select('store_id, stores(id, name)')
          .eq('user_id', user.id)
          .single();

        if (employee?.store_id) {
          setStoreId(employee.store_id);
          setStoreName((employee as any).stores?.name || '');
          setStores([{ id: employee.store_id, name: (employee as any).stores?.name }]);
        }
      }

      setLoading(false);
    };

    checkAuth();
  }, [router, supabase]);

  useEffect(() => {
    if (storeId) {
      const fetchSalesData = async () => {
        const startDate = new Date(selectedMonth + '-01');
        const endDate = endOfMonth(startDate);

        try {
          // Fetch sales transactions with items and product details
          const { data: transactions, error } = await supabase
            .from('sales_transactions')
            .select(`
              *,
              sales_items(
                *,
                product:products(
                  name,
                  category
                )
              )
            `)
            .eq('store_id', storeId)
            .eq('payment_status', 'completed')
            .gte('sold_at', startDate.toISOString())
            .lte('sold_at', endDate.toISOString())
            .order('sold_at', { ascending: false });

          if (error) {
            console.error('Error fetching sales data:', error);
            return;
          }

          // Transform data to SalesData format
          const transformedData: SalesData[] = [];
          
          transactions?.forEach(transaction => {
            transaction.sales_items?.forEach((item: any) => {
              transformedData.push({
                date: transaction.sold_at,
                productName: item.product?.name || 'Unknown Product',
                category: item.product?.category || 'Unknown',
                quantity: item.quantity,
                unitPrice: item.unit_price,
                totalAmount: item.total_amount,
                paymentMethod: transaction.payment_method,
                storeName: storeName
              });
            });
          });

          setSalesData(transformedData);
        } catch (error) {
          console.error('Error:', error);
        }
      };

      fetchSalesData();
    }
  }, [selectedMonth, storeId, storeName, supabase]);



  // 일별 매출 집계
  const getDailySales = () => {
    const dailyMap = new Map<string, number>();

    salesData.forEach(sale => {
      const date = sale.date.split('T')[0];
      const current = dailyMap.get(date) || 0;
      dailyMap.set(date, current + sale.totalAmount);
    });

    // 월의 모든 날짜 생성
    const start = startOfMonth(parseISO(`${selectedMonth}-01`));
    const end = endOfMonth(start);
    const allDays = eachDayOfInterval({ start, end });

    return allDays.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      return {
        date: dateStr,
        sales: dailyMap.get(dateStr) || 0
      };
    });
  };

  // 카테고리별 매출 집계
  const getCategorySales = () => {
    const categoryMap = new Map<string, number>();

    salesData.forEach(sale => {
      const current = categoryMap.get(sale.category) || 0;
      categoryMap.set(sale.category, current + sale.totalAmount);
    });

    return Array.from(categoryMap.entries()).map(([category, sales]) => ({
      category,
      sales
    }));
  };

  // 결제 방법별 집계
  const getPaymentMethodStats = () => {
    const paymentMap = new Map<string, number>();

    salesData.forEach(sale => {
      const current = paymentMap.get(sale.paymentMethod) || 0;
      paymentMap.set(sale.paymentMethod, current + sale.totalAmount);
    });

    return Array.from(paymentMap.entries()).map(([method, amount]) => ({
      method,
      amount
    }));
  };

  // 인기 상품 Top 10
  const getTopProducts = () => {
    const productMap = new Map<string, { quantity: number; sales: number }>();

    salesData.forEach(sale => {
      const current = productMap.get(sale.productName) || { quantity: 0, sales: 0 };
      productMap.set(sale.productName, {
        quantity: current.quantity + sale.quantity,
        sales: current.sales + sale.totalAmount
      });
    });

    return Array.from(productMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);
  };

  // 차트 데이터 생성
  const dailySalesData = getDailySales();
  const lineChartData = {
    labels: dailySalesData.map(d => format(parseISO(d.date), 'MM/dd')),
    datasets: [
      {
        label: '일별 매출',
        data: dailySalesData.map(d => d.sales),
        borderColor: '#FDB813',
        backgroundColor: 'rgba(253, 184, 19, 0.1)',
        tension: 0.4
      }
    ]
  };

  const categoryData = getCategorySales();
  const barChartData = {
    labels: categoryData.map(c => c.category),
    datasets: [
      {
        label: '카테고리별 매출',
        data: categoryData.map(c => c.sales),
        backgroundColor: '#FDB813',
        borderColor: '#FDB813',
        borderWidth: 1
      }
    ]
  };

  const paymentData = getPaymentMethodStats();
  const pieChartData = {
    labels: paymentData.map(p => p.method),
    datasets: [
      {
        data: paymentData.map(p => p.amount),
        backgroundColor: [
          '#FDB813',
          '#FFE082',
          '#FFF59D',
          '#E6EE9C',
          '#DCE775'
        ],
        borderWidth: 1
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: false
      }
    }
  };

  // 총 매출 계산
  const totalSales = salesData.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const totalQuantity = salesData.reduce((sum, sale) => sum + sale.quantity, 0);
  const uniqueTransactions = new Set(salesData.map(s => s.date)).size;
  const averageTicket = uniqueTransactions > 0 ? totalSales / uniqueTransactions : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-bagel-yellow mx-auto"></div>
          <p className="mt-4 text-gray-800 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">매출 분석</h1>
        
        <div className="flex items-center space-x-4">
          {(userRole === 'super_admin' || userRole === 'admin') && stores.length > 1 && (
            <select
              value={storeId || ''}
              onChange={(e) => {
                const store = stores.find(s => s.id === e.target.value);
                if (store) {
                  setStoreId(store.id);
                  setStoreName(store.name);
                }
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent"
            >
              {stores.map(store => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          )}
          
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent"
          />
        </div>
      </div>

      <div className="mb-4">
        <p className="text-gray-600 flex items-center">
          <Store className="w-4 h-4 mr-2" />
          {storeName} - {format(parseISO(`${selectedMonth}-01`), 'yyyy년 MM월', { locale: ko })}
        </p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">총 매출</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                ₩{totalSales.toLocaleString()}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-bagel-yellow" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">판매 수량</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {totalQuantity.toLocaleString()}개
              </p>
            </div>
            <Package className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">평균 객단가</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                ₩{Math.round(averageTicket).toLocaleString()}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">거래 건수</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {uniqueTransactions.toLocaleString()}건
              </p>
            </div>
            <BarChart3 className="h-8 w-8 text-purple-500" />
          </div>
        </div>
      </div>

      {salesData.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <Calendar className="h-16 w-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            매출 데이터가 없습니다
          </h3>
          <p className="text-gray-600">
            선택한 기간에 매출 데이터가 없습니다.
          </p>
        </div>
      ) : (
        <>
          {/* 차트 영역 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* 일별 매출 추이 */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                일별 매출 추이
              </h3>
              <Line data={lineChartData} options={chartOptions} />
            </div>

            {/* 카테고리별 매출 */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                카테고리별 매출
              </h3>
              <Bar data={barChartData} options={chartOptions} />
            </div>

            {/* 결제 방법별 비율 */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                결제 방법별 비율
              </h3>
              <Pie data={pieChartData} options={chartOptions} />
            </div>

            {/* 인기 상품 Top 10 */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                인기 상품 Top 10
              </h3>
              <div className="space-y-3">
                {getTopProducts().map((product, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-700 w-8">
                        {index + 1}.
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {product.name}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        ₩{product.sales.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-700">
                        {product.quantity}개
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}