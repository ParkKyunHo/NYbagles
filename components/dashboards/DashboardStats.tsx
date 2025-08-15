'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Users, 
  UserCheck, 
  UserX, 
  TrendingUp,
  Clock,
  AlertCircle,
  Bell,
  ArrowUp,
  ArrowDown
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface StatsCardProps {
  title: string
  value: string | number
  change?: number
  icon: React.ReactNode
  color: string
  delay?: number
  alert?: boolean
}

function StatsCard({ title, value, change, icon, color, delay = 0, alert = false }: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ scale: 1.02 }}
      className={`
        relative bg-white rounded-xl shadow-sm border border-gray-200 p-6
        hover:shadow-lg transition-all duration-200
        ${alert ? 'border-red-400 animate-pulse' : ''}
      `}
    >
      {alert && (
        <div className="absolute -top-2 -right-2">
          <div className="relative">
            <Bell className="h-5 w-5 text-red-500 animate-bounce" />
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-ping" />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <div className="flex items-baseline gap-2 mt-2">
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {change !== undefined && (
              <span className={`
                flex items-center text-sm font-medium
                ${change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-500'}
              `}>
                {change > 0 ? <ArrowUp className="h-3 w-3" /> : change < 0 ? <ArrowDown className="h-3 w-3" /> : null}
                {Math.abs(change)}%
              </span>
            )}
          </div>
        </div>
        <div className={`
          p-3 rounded-lg ${color}
        `}>
          {icon}
        </div>
      </div>
    </motion.div>
  )
}

interface DashboardStatsProps {
  userRole: string
  storeId?: string | null
}

export function DashboardStats({ userRole, storeId }: DashboardStatsProps) {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    pendingApprovals: 0,
    newThisMonth: 0,
    todaySales: 0,
    weeklyGrowth: 0,
    lowStock: 0
  })
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchStats()
    // Real-time subscription for updates
    const channel = supabase
      .channel('stats-updates')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'employees' },
        () => fetchStats()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'employee_signup_requests' },
        () => fetchStats()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [storeId]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchStats = async () => {
    try {
      // Fetch employee stats
      const { data: employees } = await supabase
        .from('employees')
        .select('*, profiles(*)')
        .eq(storeId ? 'store_id' : 'organization_id', storeId || 'default')

      // Fetch pending approvals (for admin/super_admin)
      let pendingCount = 0
      if (['admin', 'super_admin'].includes(userRole)) {
        const { count } = await supabase
          .from('employee_signup_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'verified')
        pendingCount = count || 0
      }

      // Calculate stats
      const total = employees?.length || 0
      const active = employees?.filter(e => e.is_active).length || 0
      
      // New employees this month
      const thisMonth = new Date()
      thisMonth.setDate(1)
      const newThisMonth = employees?.filter(e => 
        new Date(e.created_at) >= thisMonth
      ).length || 0

      setStats({
        totalEmployees: total,
        activeEmployees: active,
        pendingApprovals: pendingCount,
        newThisMonth,
        todaySales: Math.floor(Math.random() * 50000) + 30000, // Mock data
        weeklyGrowth: Math.floor(Math.random() * 20) - 5, // Mock data
        lowStock: Math.floor(Math.random() * 5) // Mock data
      })
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
            <div className="h-8 bg-gray-200 rounded w-3/4" />
          </div>
        ))}
      </div>
    )
  }

  const getStatsForRole = () => {
    switch (userRole) {
      case 'super_admin':
      case 'admin':
        return [
          {
            title: '전체 직원',
            value: `${stats.totalEmployees}명`,
            icon: <Users className="h-6 w-6 text-white" />,
            color: 'bg-blue-500',
            change: stats.newThisMonth > 0 ? 5 : 0
          },
          {
            title: '활성 직원',
            value: `${stats.activeEmployees}명`,
            icon: <UserCheck className="h-6 w-6 text-white" />,
            color: 'bg-green-500'
          },
          {
            title: '승인 대기',
            value: stats.pendingApprovals,
            icon: <Clock className="h-6 w-6 text-white" />,
            color: 'bg-yellow-500',
            alert: stats.pendingApprovals > 0
          },
          {
            title: '이달 신규',
            value: `${stats.newThisMonth}명`,
            icon: <TrendingUp className="h-6 w-6 text-white" />,
            color: 'bg-purple-500'
          }
        ]
      case 'manager':
        return [
          {
            title: '오늘 매출',
            value: `₩${stats.todaySales.toLocaleString()}`,
            icon: <TrendingUp className="h-6 w-6 text-white" />,
            color: 'bg-green-500',
            change: stats.weeklyGrowth
          },
          {
            title: '근무 직원',
            value: `${stats.activeEmployees}명`,
            icon: <Users className="h-6 w-6 text-white" />,
            color: 'bg-blue-500'
          },
          {
            title: '재고 부족',
            value: `${stats.lowStock}개`,
            icon: <AlertCircle className="h-6 w-6 text-white" />,
            color: stats.lowStock > 0 ? 'bg-red-500' : 'bg-gray-500',
            alert: stats.lowStock > 3
          },
          {
            title: '대기 시간',
            value: '평균 5분',
            icon: <Clock className="h-6 w-6 text-white" />,
            color: 'bg-yellow-500'
          }
        ]
      default:
        return [
          {
            title: '이번 주 근무',
            value: '32시간',
            icon: <Clock className="h-6 w-6 text-white" />,
            color: 'bg-blue-500'
          },
          {
            title: '이번 달 급여',
            value: '₩1,850,000',
            icon: <TrendingUp className="h-6 w-6 text-white" />,
            color: 'bg-green-500'
          },
          {
            title: '남은 연차',
            value: '8일',
            icon: <UserCheck className="h-6 w-6 text-white" />,
            color: 'bg-purple-500'
          },
          {
            title: '다음 일정',
            value: '내일 09:00',
            icon: <Clock className="h-6 w-6 text-white" />,
            color: 'bg-yellow-500'
          }
        ]
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {getStatsForRole().map((stat, index) => (
        <StatsCard
          key={stat.title}
          {...stat}
          delay={index * 0.1}
        />
      ))}
    </div>
  )
}