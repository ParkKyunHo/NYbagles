'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Database } from '@/types/supabase';
import { 
  Upload, 
  FileSpreadsheet, 
  BarChart3, 
  TrendingUp, 
  Calendar,
  Download,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';
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

type Profile = Database['public']['Tables']['profiles']['Row'];

interface SalesData {
  date: string;
  productName: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  paymentMethod: string;
  employeeName?: string;
  storeName?: string;
}

export default function AnalyticsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [fileName, setFileName] = useState<string>('');
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkAuth();
  }, []);

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

    setProfile(profileData);
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setFileName(file.name);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // 엑셀 데이터를 SalesData 형식으로 변환
      const parsedData: SalesData[] = jsonData.map((row: any) => ({
        date: row['날짜'] || row['Date'] || '',
        productName: row['상품명'] || row['Product'] || '',
        category: row['카테고리'] || row['Category'] || '',
        quantity: parseInt(row['수량'] || row['Quantity'] || 0),
        unitPrice: parseFloat(row['단가'] || row['Unit Price'] || 0),
        totalAmount: parseFloat(row['총액'] || row['Total'] || 0),
        paymentMethod: row['결제방법'] || row['Payment'] || '현금',
        employeeName: row['직원명'] || row['Employee'] || '',
        storeName: row['매장명'] || row['Store'] || ''
      }));

      setSalesData(parsedData);
      alert('엑셀 파일이 성공적으로 업로드되었습니다.');
    } catch (error) {
      console.error('Error parsing Excel file:', error);
      alert('엑셀 파일 처리 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };

  // 월별 매출 데이터 필터링
  const getMonthlyData = () => {
    return salesData.filter(sale => {
      const saleDate = sale.date.includes('-') ? sale.date : '';
      return saleDate.startsWith(selectedMonth);
    });
  };

  // 일별 매출 집계
  const getDailySales = () => {
    const monthlyData = getMonthlyData();
    const dailyMap = new Map<string, number>();

    monthlyData.forEach(sale => {
      const date = sale.date.split(' ')[0]; // 날짜만 추출
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
    const monthlyData = getMonthlyData();
    const categoryMap = new Map<string, number>();

    monthlyData.forEach(sale => {
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
    const monthlyData = getMonthlyData();
    const paymentMap = new Map<string, number>();

    monthlyData.forEach(sale => {
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
    const monthlyData = getMonthlyData();
    const productMap = new Map<string, { quantity: number; sales: number }>();

    monthlyData.forEach(sale => {
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
  const totalSales = getMonthlyData().reduce((sum, sale) => sum + sale.totalAmount, 0);
  const totalQuantity = getMonthlyData().reduce((sum, sale) => sum + sale.quantity, 0);
  const averageTicket = totalQuantity > 0 ? totalSales / totalQuantity : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-bagel-yellow mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">매출 분석</h1>
        
        <div className="flex items-center space-x-4">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent"
          />
          
          <label className="relative">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
            <Button
              onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
              disabled={uploading}
              className="bg-bagel-yellow hover:bg-yellow-600 text-black"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-black mr-2"></div>
                  업로드 중...
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5 mr-2" />
                  엑셀 업로드
                </>
              )}
            </Button>
          </label>
        </div>
      </div>

      {fileName && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
          <FileSpreadsheet className="h-5 w-5 text-green-600 mr-2" />
          <span className="text-sm text-green-800">업로드된 파일: {fileName}</span>
        </div>
      )}

      {salesData.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <FileSpreadsheet className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            매출 데이터가 없습니다
          </h3>
          <p className="text-gray-600 mb-6">
            엑셀 파일을 업로드하여 매출 분석을 시작하세요
          </p>
          
          <div className="bg-gray-50 rounded-lg p-6 text-left max-w-lg mx-auto">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 text-bagel-yellow" />
              엑셀 파일 형식
            </h4>
            <p className="text-sm text-gray-600 mb-3">
              다음 열이 포함된 엑셀 파일을 준비해주세요:
            </p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• 날짜 (Date)</li>
              <li>• 상품명 (Product)</li>
              <li>• 카테고리 (Category)</li>
              <li>• 수량 (Quantity)</li>
              <li>• 단가 (Unit Price)</li>
              <li>• 총액 (Total)</li>
              <li>• 결제방법 (Payment)</li>
              <li>• 직원명 (Employee) - 선택</li>
              <li>• 매장명 (Store) - 선택</li>
            </ul>
          </div>
        </div>
      ) : (
        <>
          {/* 통계 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">총 매출</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    ₩{totalSales.toLocaleString()}
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-bagel-yellow" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">판매 수량</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    {totalQuantity.toLocaleString()}개
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">평균 객단가</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    ₩{Math.round(averageTicket).toLocaleString()}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">거래 건수</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    {getMonthlyData().length.toLocaleString()}건
                  </p>
                </div>
                <FileSpreadsheet className="h-8 w-8 text-purple-500" />
              </div>
            </div>
          </div>

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
                      <span className="text-sm font-medium text-gray-500 w-8">
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
                      <p className="text-xs text-gray-500">
                        {product.quantity}개
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 다운로드 섹션 */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              데이터 내보내기
            </h3>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                현재 표시된 {selectedMonth} 월의 분석 데이터를 다운로드할 수 있습니다.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  // 분석 결과를 엑셀로 다운로드하는 기능 (추후 구현)
                  alert('준비 중인 기능입니다.');
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                분석 결과 다운로드
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}