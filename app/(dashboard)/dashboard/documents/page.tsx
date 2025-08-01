'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Database } from '@/types/supabase';
import { 
  FileText, 
  Upload, 
  Download, 
  Trash2, 
  Eye,
  Filter,
  Search,
  Calendar,
  User,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Document = Database['public']['Tables']['documents']['Row'];
type Employee = Database['public']['Tables']['employees']['Row'] & {
  profiles?: Profile;
};

interface DocumentWithEmployee extends Document {
  employees?: Employee;
  uploaded_by_profile?: Profile;
}

const DOCUMENT_TYPES = {
  id_card: '신분증',
  resident_registration: '주민등록등본',
  bank_account: '통장 사본',
  health_certificate: '보건증'
} as const;

export default function DocumentsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [documents, setDocuments] = useState<DocumentWithEmployee[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadData, setUploadData] = useState({
    employee_id: '',
    document_type: '',
    expiry_date: '',
    file: null as File | null
  });
  
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

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profileData) {
      console.error('Profile fetch error:', profileError);
      alert('프로필 정보를 불러올 수 없습니다. 다시 로그인해주세요.');
      router.push('/login');
      return;
    }

    setProfile(profileData);
    await fetchData(profileData);
    setLoading(false);
  };

  const fetchData = async (userProfile: Profile) => {
    try {
      // 직원 목록 가져오기
      let employeesQuery = supabase
        .from('employees')
        .select(`
          *,
          profiles!inner(*)
        `)
        .order('profiles(full_name)');

      // 매니저는 자기 매장 직원만
      if (userProfile.role === 'manager') {
        const { data: managerEmployee } = await supabase
          .from('employees')
          .select('store_id')
          .eq('user_id', userProfile.id)
          .single();

        if (managerEmployee?.store_id) {
          employeesQuery = employeesQuery.eq('store_id', managerEmployee.store_id);
        }
      }

      const { data: employeesData } = await employeesQuery;
      if (employeesData) setEmployees(employeesData);

      // 문서 목록 가져오기
      let documentsQuery = supabase
        .from('documents')
        .select(`
          *,
          employees!inner(
            *,
            profiles(*)
          ),
          uploaded_by_profile:profiles!documents_uploaded_by_fkey(*)
        `)
        .order('created_at', { ascending: false });

      // 일반 직원은 자기 문서만
      if (!['super_admin', 'admin', 'manager'].includes(userProfile.role)) {
        const { data: currentEmployee } = await supabase
          .from('employees')
          .select('id')
          .eq('user_id', userProfile.id)
          .single();

        if (currentEmployee) {
          documentsQuery = documentsQuery.eq('employee_id', currentEmployee.id);
        }
      }

      const { data: documentsData } = await documentsQuery;
      if (documentsData) setDocuments(documentsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadData.file || !uploadData.employee_id || !uploadData.document_type) {
      alert('모든 필드를 입력해주세요.');
      return;
    }

    setUploading(true);

    try {
      // 파일을 Supabase Storage에 업로드
      const fileExt = uploadData.file.name.split('.').pop();
      const fileName = `${uploadData.employee_id}/${uploadData.document_type}_${Date.now()}.${fileExt}`;
      
      const { data: uploadResult, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, uploadData.file);

      if (uploadError) throw uploadError;

      // 문서 정보를 데이터베이스에 저장
      const { error: dbError } = await supabase
        .from('documents')
        .insert({
          employee_id: uploadData.employee_id,
          document_type: uploadData.document_type as any,
          file_url: uploadResult.path,
          file_name: uploadData.file.name,
          expiry_date: uploadData.expiry_date || null,
          uploaded_by: profile?.id
        });

      if (dbError) throw dbError;

      alert('문서가 성공적으로 업로드되었습니다.');
      setShowUploadModal(false);
      setUploadData({
        employee_id: '',
        document_type: '',
        expiry_date: '',
        file: null
      });
      
      if (profile) await fetchData(profile);
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('문서 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (documentId: string, fileUrl: string) => {
    if (!confirm('정말로 이 문서를 삭제하시겠습니까?')) return;

    try {
      // Storage에서 파일 삭제
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([fileUrl]);

      if (storageError) console.error('Storage deletion error:', storageError);

      // 데이터베이스에서 레코드 삭제
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (dbError) throw dbError;

      alert('문서가 삭제되었습니다.');
      if (profile) await fetchData(profile);
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('문서 삭제에 실패했습니다.');
    }
  };

  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(fileUrl);

      if (error) throw error;

      // 다운로드 링크 생성
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('문서 다운로드에 실패했습니다.');
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesEmployee = selectedEmployee === 'all' || doc.employee_id === selectedEmployee;
    const matchesType = selectedType === 'all' || doc.document_type === selectedType;
    const matchesSearch = searchTerm === '' || 
      doc.employees?.profiles?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.file_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesEmployee && matchesType && matchesSearch;
  });

  const canUpload = profile && ['super_admin', 'admin', 'manager'].includes(profile.role);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-bagel-yellow mx-auto"></div>
          <p className="mt-4 text-gray-600">문서 목록 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">문서 관리</h1>
        
        {canUpload && (
          <Button
            onClick={() => setShowUploadModal(true)}
            className="bg-bagel-yellow hover:bg-yellow-600 text-black"
          >
            <Upload className="h-5 w-5 mr-2" />
            문서 업로드
          </Button>
        )}
      </div>

      {/* 필터 영역 */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              직원 필터
            </label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent text-gray-900 bg-white"
            >
              <option value="all">전체 직원</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.profiles?.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              문서 유형
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent text-gray-900 bg-white"
            >
              <option value="all">전체 유형</option>
              {Object.entries(DOCUMENT_TYPES).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              검색
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="직원명 또는 파일명 검색"
                className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 문서 목록 */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            문서 목록 ({filteredDocuments.length}개)
          </h2>
        </div>

        {filteredDocuments.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-700">등록된 문서가 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    직원
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    문서 유형
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    파일명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    만료일
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    업로드
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                    액션
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDocuments.map((doc) => {
                  const isExpired = doc.expiry_date && new Date(doc.expiry_date) < new Date();
                  
                  return (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <User className="h-4 w-4 text-gray-600 mr-2" />
                          <span className="text-sm font-medium text-gray-900">
                            {doc.employees?.profiles?.full_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          {DOCUMENT_TYPES[doc.document_type as keyof typeof DOCUMENT_TYPES]}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900">
                          {doc.file_name}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {doc.expiry_date ? (
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 text-gray-600 mr-2" />
                            <span className={`text-sm ${isExpired ? 'text-red-600 font-semibold' : 'text-gray-900'}`}>
                              {format(new Date(doc.expiry_date), 'yyyy-MM-dd')}
                            </span>
                            {isExpired && (
                              <AlertCircle className="h-4 w-4 text-red-600 ml-2" />
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-700">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {doc.uploaded_by_profile?.full_name}
                        </div>
                        <div className="text-sm text-gray-700">
                          {format(new Date(doc.created_at), 'yyyy-MM-dd', { locale: ko })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <Button
                            onClick={() => doc.file_url && doc.file_name && handleDownload(doc.file_url, doc.file_name)}
                            variant="outline"
                            size="sm"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          {canUpload && (
                            <Button
                              onClick={() => doc.file_url && handleDelete(doc.id, doc.file_url)}
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 업로드 모달 */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              문서 업로드
            </h2>
            
            <form onSubmit={handleFileUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  직원 선택 *
                </label>
                <select
                  value={uploadData.employee_id}
                  onChange={(e) => setUploadData(prev => ({ ...prev, employee_id: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent text-gray-900 bg-white"
                >
                  <option value="">직원을 선택하세요</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.profiles?.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  문서 유형 *
                </label>
                <select
                  value={uploadData.document_type}
                  onChange={(e) => setUploadData(prev => ({ ...prev, document_type: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent text-gray-900 bg-white"
                >
                  <option value="">문서 유형을 선택하세요</option>
                  {Object.entries(DOCUMENT_TYPES).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  만료일 (선택)
                </label>
                <input
                  type="date"
                  value={uploadData.expiry_date}
                  onChange={(e) => setUploadData(prev => ({ ...prev, expiry_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent text-gray-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  파일 선택 *
                </label>
                <input
                  type="file"
                  onChange={(e) => setUploadData(prev => ({ ...prev, file: e.target.files?.[0] || null }))}
                  required
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bagel-yellow focus:border-transparent text-gray-900 bg-white"
                />
                <p className="mt-1 text-xs text-gray-700">
                  PDF, JPG, PNG 파일만 업로드 가능합니다
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadData({
                      employee_id: '',
                      document_type: '',
                      expiry_date: '',
                      file: null
                    });
                  }}
                >
                  취소
                </Button>
                <Button
                  type="submit"
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
                      <Upload className="h-4 w-4 mr-2" />
                      업로드
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}