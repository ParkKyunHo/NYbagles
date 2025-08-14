'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Settings, Save, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SystemSetting {
  id: string
  key: string
  value: boolean
  description: string
}

export default function SystemSettingsPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkAuthAndLoadSettings = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!profile || profile.role !== 'super_admin') {
        router.push('/dashboard')
        return
      }

      // fetchSettings 로직을 직접 포함
      setLoading(true)
      
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('*')
          .order('key')

        if (error) throw error

        const formattedSettings = data?.map(setting => ({
          ...setting,
          value: setting.value === true || setting.value === 'true'
        })) || []

        setSettings(formattedSettings)
      } catch (error) {
        console.error('Error fetching settings:', error)
        setError('설정을 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    checkAuthAndLoadSettings()
  }, [router, supabase])

  const handleToggle = (key: string) => {
    setSettings(settings.map(setting => 
      setting.key === key 
        ? { ...setting, value: !setting.value }
        : setting
    ))
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      // 각 설정을 업데이트
      for (const setting of settings) {
        const { error } = await supabase
          .from('system_settings')
          .update({ 
            value: setting.value,
            updated_at: new Date().toISOString()
          })
          .eq('id', setting.id)

        if (error) throw error
      }

      setSuccess('설정이 성공적으로 저장되었습니다.')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error saving settings:', error)
      setError('설정 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bagel-yellow mx-auto"></div>
          <p className="mt-4 text-gray-800 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8 text-gray-700" />
          <h1 className="text-3xl font-bold text-gray-900">시스템 설정</h1>
        </div>
        <p className="text-gray-800 mt-2">전체 시스템의 기능을 관리합니다.</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 space-y-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">매장 관리 설정</h2>
          
          {settings.map((setting) => (
            <div key={setting.key} className="flex items-start justify-between py-4 border-b last:border-b-0">
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900">
                  {setting.key === 'multi_store_enabled' && '다중 매장 기능'}
                  {setting.key === 'store_selection_required' && '매장 선택 필수'}
                  {setting.key === 'manager_store_restriction' && '매니저 매장 제한'}
                </h3>
                <p className="text-sm text-gray-700 mt-1">
                  {setting.description}
                </p>
              </div>
              <div className="ml-4">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={setting.value}
                    onChange={() => handleToggle(setting.key)}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-bagel-yellow"></div>
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? '저장 중...' : '설정 저장'}
          </Button>
        </div>
      </div>

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>참고:</strong> 이 설정들은 전체 시스템에 즉시 적용됩니다. 
          변경 시 모든 사용자에게 영향을 미치므로 신중하게 설정해주세요.
        </p>
      </div>
    </div>
  )
}