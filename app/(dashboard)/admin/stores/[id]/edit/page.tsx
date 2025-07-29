'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Database } from '@/types/supabase';
import { ArrowLeft, Save, MapPin, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Store = Database['public']['Tables']['stores']['Row'];
type StoreCategory = Database['public']['Tables']['store_categories']['Row'];
type Region = Database['public']['Tables']['regions']['Row'];

interface StoreWithRelations extends Store {
  store_categories?: StoreCategory & {
    regions?: Region;
  };
}

export default function EditStorePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [store, setStore] = useState<StoreWithRelations | null>(null);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    category_id: '',
    address: '',
    phone: '',
    email: '',
    location_lat: '',
    location_lng: '',
    location_radius: 50,
    operating_hours: {
      monday: { open: '09:00', close: '21:00' },
      tuesday: { open: '09:00', close: '21:00' },
      wednesday: { open: '09:00', close: '21:00' },
      thursday: { open: '09:00', close: '21:00' },
      friday: { open: '09:00', close: '21:00' },
      saturday: { open: '09:00', close: '21:00' },
      sunday: { open: '09:00', close: '21:00' }
    }
  });
  
  const router = useRouter();
  const params = useParams();
  const storeId = params.id as string;
  const supabase = createClient();

  useEffect(() => {
    checkAuth();
    fetchData();
  }, [storeId]);

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
  };

  const fetchData = async () => {
    try {
      const [storeRes, categoriesRes, regionsRes] = await Promise.all([
        supabase
          .from('stores')
          .select(`
            *,
            store_categories (
              *,
              regions (*)
            )
          `)
          .eq('id', storeId)
          .single(),
        supabase.from('store_categories').select('*').order('name'),
        supabase.from('regions').select('*').order('name')
      ]);

      if (storeRes.error) throw storeRes.error;
      if (!storeRes.data) {
        router.push('/admin/stores');
        return;
      }

      setStore(storeRes.data);
      if (categoriesRes.data) setCategories(categoriesRes.data);
      if (regionsRes.data) setRegions(regionsRes.data);

      // 초기 폼 데이터 설정
      const regionId = storeRes.data.store_categories?.region_id || '';
      setSelectedRegion(regionId);
      
      setFormData({
        name: storeRes.data.name,
        code: storeRes.data.code,
        category_id: storeRes.data.category_id,
        address: storeRes.data.address || '',
        phone: storeRes.data.phone || '',
        email: storeRes.data.email || '',
        location_lat: storeRes.data.location_lat?.toString() || '',
        location_lng: storeRes.data.location_lng?.toString() || '',
        location_radius: storeRes.data.location_radius || 50,
        operating_hours: storeRes.data.operating_hours as any || {
          monday: { open: '09:00', close: '21:00' },
          tuesday: { open: '09:00', close: '21:00' },
          wednesday: { open: '09:00', close: '21:00' },
          thursday: { open: '09:00', close: '21:00' },
          friday: { open: '09:00', close: '21:00' },
          saturday: { open: '09:00', close: '21:00' },
          sunday: { open: '09:00', close: '21:00' }
        }
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('데이터를 불러오는 중 오류가 발생했습니다.');
      router.push('/admin/stores');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase
        .from('stores')
        .update({
          name: formData.name,
          code: formData.code.toUpperCase(),
          category_id: formData.category_id,
          address: formData.address || null,
          phone: formData.phone || null,
          email: formData.email || null,
          location_lat: formData.location_lat ? parseFloat(formData.location_lat) : null,
          location_lng: formData.location_lng ? parseFloat(formData.location_lng) : null,
          location_radius: formData.location_radius,
          operating_hours: formData.operating_hours,
        })
        .eq('id', storeId);

      if (error) throw error;

      router.push('/admin/stores');
    } catch (error) {
      console.error('Error updating store:', error);
      alert('매장 정보 수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('정말로 이 매장을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    try {
      // 먼저 매장을 비활성화
      const { error } = await supabase
        .from('stores')
        .update({ is_active: false })
        .eq('id', storeId);

      if (error) throw error;

      alert('매장이 비활성화되었습니다.');
      router.push('/admin/stores');
    } catch (error) {
      console.error('Error deleting store:', error);
      alert('매장 삭제에 실패했습니다.');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleOperatingHoursChange = (day: string, type: 'open' | 'close', value: string) => {
    setFormData(prev => ({
      ...prev,
      operating_hours: {
        ...prev.operating_hours,
        [day]: {
          ...prev.operating_hours[day as keyof typeof prev.operating_hours],
          [type]: value
        }
      }
    }));
  };

  const filteredCategories = selectedRegion 
    ? categories.filter(cat => cat.region_id === selectedRegion)
    : categories;

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

  if (!store) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <Button
            onClick={() => router.push('/admin/stores')}
            variant="ghost"
            className="mr-4"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">매장 정보 수정</h1>
        </div>
        
        <Button
          onClick={handleDelete}
          variant="outline"
          className="text-red-600 hover:bg-red-50"
        >
          <Trash2 className="h-5 w-5 mr-2" />
          매장 삭제
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* 기본 정보 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">기본 정보</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                매장명 *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                매장 코드 *
              </label>
              <input
                type="text"
                name="code"
                value={formData.code}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent"
              />
              <p className="mt-1 text-sm text-gray-500">대문자로 자동 변환됩니다</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                지역 *
              </label>
              <select
                value={selectedRegion}
                onChange={(e) => {
                  setSelectedRegion(e.target.value);
                  setFormData(prev => ({ ...prev, category_id: '' }));
                }}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent"
              >
                <option value="">지역을 선택하세요</option>
                {regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                카테고리 *
              </label>
              <select
                name="category_id"
                value={formData.category_id}
                onChange={handleInputChange}
                required
                disabled={!selectedRegion}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent disabled:bg-gray-100"
              >
                <option value="">카테고리를 선택하세요</option>
                {filteredCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 연락처 정보 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">연락처 정보</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                전화번호
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent"
                placeholder="예: 02-1234-5678"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                이메일
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent"
                placeholder="예: gangnam@nylovebagel.com"
              />
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              주소
            </label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent"
              placeholder="예: 서울특별시 강남구 테헤란로 123"
            />
          </div>
        </div>

        {/* 위치 정보 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <MapPin className="h-5 w-5 mr-2" />
            위치 정보
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                위도
              </label>
              <input
                type="text"
                name="location_lat"
                value={formData.location_lat}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent"
                placeholder="예: 37.498095"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                경도
              </label>
              <input
                type="text"
                name="location_lng"
                value={formData.location_lng}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent"
                placeholder="예: 127.027610"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                허용 반경 (미터)
              </label>
              <input
                type="number"
                name="location_radius"
                value={formData.location_radius}
                onChange={handleInputChange}
                min="10"
                max="1000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent"
              />
            </div>
          </div>
          
          <p className="mt-2 text-sm text-gray-500">
            위치 정보는 QR 체크인 시 거리 검증에 사용됩니다
          </p>
        </div>

        {/* 운영 시간 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">운영 시간</h2>
          
          <div className="space-y-4">
            {Object.entries(formData.operating_hours).map(([day, hours]) => (
              <div key={day} className="flex items-center space-x-4">
                <span className="w-24 text-sm font-medium text-gray-700 capitalize">
                  {day === 'monday' && '월요일'}
                  {day === 'tuesday' && '화요일'}
                  {day === 'wednesday' && '수요일'}
                  {day === 'thursday' && '목요일'}
                  {day === 'friday' && '금요일'}
                  {day === 'saturday' && '토요일'}
                  {day === 'sunday' && '일요일'}
                </span>
                <input
                  type="time"
                  value={hours.open}
                  onChange={(e) => handleOperatingHoursChange(day, 'open', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent"
                />
                <span className="text-gray-500">~</span>
                <input
                  type="time"
                  value={hours.close}
                  onChange={(e) => handleOperatingHoursChange(day, 'close', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent"
                />
              </div>
            ))}
          </div>
        </div>

        {/* 제출 버튼 */}
        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/admin/stores')}
          >
            취소
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="bg-bagel-yellow hover:bg-yellow-600 text-black"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-black mr-2"></div>
                저장 중...
              </>
            ) : (
              <>
                <Save className="h-5 w-5 mr-2" />
                변경사항 저장
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}