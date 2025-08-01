'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Database } from '@/types/supabase';
import { ArrowLeft, Save, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';

type StoreCategory = Database['public']['Tables']['store_categories']['Row'];
type Region = Database['public']['Tables']['regions']['Row'];

export default function CreateStorePage() {
  const [loading, setLoading] = useState(false);
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
  const supabase = createClient();

  useEffect(() => {
    checkAuth();
    fetchData();
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
  };

  const fetchData = async () => {
    try {
      const [categoriesRes, regionsRes] = await Promise.all([
        supabase.from('store_categories').select('*').order('name'),
        supabase.from('regions').select('*').order('name')
      ]);

      if (categoriesRes.data) setCategories(categoriesRes.data);
      if (regionsRes.data) setRegions(regionsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const generateQRData = () => {
    const randomBytes = new Array(32)
      .fill(0)
      .map(() => Math.floor(Math.random() * 256).toString(16).padStart(2, '0'))
      .join('');
    
    return {
      qr_code_id: crypto.randomUUID(),
      qr_secret: randomBytes
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const qrData = generateQRData();
      
      const { error } = await supabase
        .from('stores')
        .insert({
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
          qr_code_id: qrData.qr_code_id,
          qr_secret: qrData.qr_secret,
          is_active: true
        });

      if (error) throw error;

      router.push('/admin/stores');
    } catch (error) {
      console.error('Error creating store:', error);
      alert('매장 생성에 실패했습니다.');
    } finally {
      setLoading(false);
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

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <div className="flex items-center mb-8">
        <Button
          onClick={() => router.push('/admin/stores')}
          variant="ghost"
          className="mr-4"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-3xl font-bold text-gray-900">새 매장 추가</h1>
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
                placeholder="예: NY베이글 강남역점"
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
                placeholder="예: GANGNAM001"
              />
              <p className="mt-1 text-sm text-gray-700">대문자로 자동 변환됩니다</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                시/도 *
              </label>
              <select
                value={selectedRegion}
                onChange={(e) => {
                  setSelectedRegion(e.target.value);
                  setFormData(prev => ({ ...prev, category_id: '' }));
                }}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent text-gray-900 bg-white"
              >
                <option value="">시/도를 선택하세요</option>
                {regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                구/군 *
              </label>
              <select
                name="category_id"
                value={formData.category_id}
                onChange={handleInputChange}
                required
                disabled={!selectedRegion}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent disabled:bg-gray-100 text-gray-900 bg-white"
              >
                <option value="">{selectedRegion ? "구/군을 선택하세요" : "먼저 시/도를 선택하세요"}</option>
                {filteredCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {selectedRegion && filteredCategories.length === 0 && (
                <p className="mt-2 text-sm text-gray-700">
                  해당 지역에 등록된 구/군이 없습니다. 관리자에게 문의하세요.
                </p>
              )}
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
          
          <p className="mt-2 text-sm text-gray-700">
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
                <span className="text-gray-700">~</span>
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
            disabled={loading}
            className="bg-bagel-yellow hover:bg-yellow-600 text-black"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-black mr-2"></div>
                저장 중...
              </>
            ) : (
              <>
                <Save className="h-5 w-5 mr-2" />
                매장 생성
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}