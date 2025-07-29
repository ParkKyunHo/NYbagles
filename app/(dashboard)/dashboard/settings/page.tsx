'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Database } from '@/types/supabase';
import { User, Lock, Bell, Settings2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ProfileSettings from './components/ProfileSettings';
import SecuritySettings from './components/SecuritySettings';
import NotificationSettings from './components/NotificationSettings';
import SystemSettings from './components/SystemSettings';

type Profile = Database['public']['Tables']['profiles']['Row'];

type TabType = 'profile' | 'security' | 'notifications' | 'system';

interface Tab {
  id: TabType;
  name: string;
  icon: any;
  component: React.ComponentType<any>;
  roles?: string[];
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  
  const router = useRouter();
  const supabase = createClient();

  const tabs: Tab[] = [
    {
      id: 'profile',
      name: '개인정보',
      icon: User,
      component: ProfileSettings
    },
    {
      id: 'security',
      name: '보안',
      icon: Lock,
      component: SecuritySettings
    },
    {
      id: 'notifications',
      name: '알림 설정',
      icon: Bell,
      component: NotificationSettings
    },
    {
      id: 'system',
      name: '시스템 설정',
      icon: Settings2,
      component: SystemSettings,
      roles: ['super_admin', 'admin']
    }
  ];

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setProfile(profileData);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTabs = tabs.filter(tab => {
    if (!tab.roles) return true;
    return profile && tab.roles.includes(profile.role);
  });

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-bagel-yellow mx-auto"></div>
          <p className="mt-4 text-gray-600">설정 정보 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">설정</h1>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="lg:grid lg:grid-cols-12">
          {/* 사이드바 */}
          <div className="lg:col-span-3 bg-gray-50 p-6">
            <nav className="space-y-1">
              {filteredTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      w-full flex items-center justify-between px-4 py-3 text-sm font-medium rounded-lg transition-colors
                      ${isActive
                        ? 'bg-bagel-yellow text-black'
                        : 'text-gray-700 hover:bg-gray-100'
                      }
                    `}
                  >
                    <div className="flex items-center">
                      <Icon className="h-5 w-5 mr-3" />
                      {tab.name}
                    </div>
                    {isActive && <ChevronRight className="h-4 w-4" />}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* 콘텐츠 영역 */}
          <div className="lg:col-span-9 p-6">
            {ActiveComponent && profile && (
              <ActiveComponent profile={profile} onUpdate={fetchProfile} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}