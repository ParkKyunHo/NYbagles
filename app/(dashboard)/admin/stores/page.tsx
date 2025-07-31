'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Database } from '@/types/supabase';
import { Plus, Edit2, MapPin, Phone, Mail, QrCode, ToggleLeft, ToggleRight, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StoreQRDisplay } from '@/components/qr/StoreQRDisplay';

type StoreType = Database['public']['Tables']['stores']['Row'];
type StoreCategory = Database['public']['Tables']['store_categories']['Row'];
type Region = Database['public']['Tables']['regions']['Row'];

interface StoreWithRelations extends StoreType {
  store_categories?: StoreCategory & {
    regions?: Region;
  };
}

export default function StoresPage() {
  const [stores, setStores] = useState<StoreWithRelations[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [userRole, setUserRole] = useState<string>('');
  const [selectedStore, setSelectedStore] = useState<StoreWithRelations | null>(null);
  const [showQR, setShowQR] = useState(false);
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
      router.push('/dashboard');
      return;
    }

    setUserRole(profile.role);
    fetchData();
  };

  const fetchData = async () => {
    try {
      const { data: storesData, error: storesError } = await supabase
        .from('stores')
        .select(`
          *,
          store_categories (
            *,
            regions (*)
          )
        `)
        .order('name');

      const { data: categoriesData } = await supabase
        .from('store_categories')
        .select('*')
        .order('name');

      const { data: regionsData } = await supabase
        .from('regions')
        .select('*')
        .order('name');

      if (storesError) throw storesError;
      
      if (storesData) setStores(storesData);
      if (categoriesData) setCategories(categoriesData);
      if (regionsData) setRegions(regionsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShowQR = (store: StoreWithRelations) => {
    setSelectedStore(store);
    setShowQR(true);
  };

  const toggleStoreStatus = async (storeId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('stores')
      .update({ is_active: !currentStatus })
      .eq('id', storeId);

    if (error) {
      console.error('Error updating store status:', error);
      alert('매장 상태 변경에 실패했습니다.');
      return;
    }

    setStores(stores.map(store => 
      store.id === storeId ? { ...store, is_active: !currentStatus } : store
    ));
  };

  const filteredStores = stores.filter(store => {
    const matchesRegion = selectedRegion === 'all' || 
      store.store_categories?.region_id === selectedRegion;
    const matchesSearch = store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         store.code.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesRegion && matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-bagel-yellow mx-auto"></div>
          <p className="mt-4 text-gray-600">매장 정보 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">매장 관리</h1>
        <Button
          onClick={() => router.push('/admin/stores/create')}
          className="bg-bagel-yellow hover:bg-yellow-600 text-black"
        >
          <Plus className="h-5 w-5 mr-2" />
          새 매장 추가
        </Button>
      </div>

      {/* 필터 및 검색 */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              지역 필터
            </label>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent text-gray-900 bg-white"
            >
              <option value="all">전체 지역</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              매장 검색
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="매장명 또는 코드로 검색"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent text-gray-900 placeholder-gray-600"
            />
          </div>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">전체 매장</h3>
          <p className="text-3xl font-bold text-gray-900">{stores.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">운영 중</h3>
          <p className="text-3xl font-bold text-green-600">
            {stores.filter(s => s.is_active).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">운영 중지</h3>
          <p className="text-3xl font-bold text-red-600">
            {stores.filter(s => !s.is_active).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">지역 수</h3>
          <p className="text-3xl font-bold text-gray-900">{regions.length}</p>
        </div>
      </div>

      {/* 매장 목록 */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            매장 목록 ({filteredStores.length}개)
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          {filteredStores.length === 0 ? (
            <div className="text-center py-12">
              <Store className="h-12 w-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-600">검색 결과가 없습니다.</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    매장 정보
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    위치
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    연락처
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                    액션
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredStores.map((store) => (
                  <tr key={store.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {store.name}
                        </div>
                        <div className="text-sm text-gray-600">
                          코드: {store.code}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {store.store_categories?.regions?.name} {store.store_categories?.name}
                      </div>
                      <div className="text-sm text-gray-500 flex items-center">
                        <MapPin className="h-3 w-3 mr-1" />
                        {store.address || '주소 미등록'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {store.phone && (
                        <div className="text-sm text-gray-900 flex items-center">
                          <Phone className="h-3 w-3 mr-1" />
                          {store.phone}
                        </div>
                      )}
                      {store.email && (
                        <div className="text-sm text-gray-500 flex items-center">
                          <Mail className="h-3 w-3 mr-1" />
                          {store.email}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => toggleStoreStatus(store.id, store.is_active)}
                        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          store.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {store.is_active ? (
                          <>
                            <ToggleRight className="h-4 w-4 mr-1" />
                            운영중
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="h-4 w-4 mr-1" />
                            중지
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <Button
                          onClick={() => router.push(`/admin/stores/${store.id}/edit`)}
                          variant="outline"
                          size="sm"
                          className="hover:bg-gray-100"
                        >
                          <Edit2 className="h-4 w-4 text-gray-600" />
                        </Button>
                        <Button
                          onClick={() => handleShowQR(store)}
                          variant="outline"
                          size="sm"
                          className="hover:bg-gray-100"
                        >
                          <QrCode className="h-4 w-4 text-gray-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* QR 코드 모달 */}
      {showQR && selectedStore && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold">{selectedStore.name} QR 코드</h2>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowQR(false)}
              >
                ✕
              </Button>
            </div>
            <StoreQRDisplay storeId={selectedStore.id} />
          </div>
        </div>
      )}
    </div>
  );
}