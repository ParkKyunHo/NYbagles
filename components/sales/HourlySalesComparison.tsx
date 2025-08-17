'use client'

import { useState, useEffect } from 'react'
import { Clock, TrendingUp, TrendingDown } from 'lucide-react'
import type { HourlySalesData } from '@/lib/data/sales.data'

interface HourlySalesComparisonProps {
  storeId: string | null
  selectedDate: Date
  initialData?: HourlySalesData[]
}

export default function HourlySalesComparison({ 
  storeId, 
  selectedDate,
  initialData
}: HourlySalesComparisonProps) {
  const [selectedHour, setSelectedHour] = useState<number | null>(null)
  const [data, setData] = useState<HourlySalesData[]>([])
  
  useEffect(() => {
    const generateMockHourlySales = (): HourlySalesData[] => {
      const data: HourlySalesData[] = []
      const currentHour = new Date().getHours()
      const maxHour = selectedDate.toDateString() === new Date().toDateString() ? currentHour : 23
      
      for (let hour = 0; hour <= maxHour; hour++) {
        const currentSales = Math.floor(Math.random() * 500000) + 100000
        const previousWeekSales = Math.floor(Math.random() * 500000) + 100000
        const difference = currentSales - previousWeekSales
        const percentageChange = previousWeekSales > 0 
          ? ((difference / previousWeekSales) * 100) 
          : 0
        
        data.push({
          hour,
          hourLabel: `${hour.toString().padStart(2, '0')}:00`,
          currentSales,
          previousWeekSales,
          currentTransactionCount: Math.floor(Math.random() * 50) + 10,
          previousTransactionCount: Math.floor(Math.random() * 50) + 10,
          difference,
          percentageChange,
          isCurrentHour: hour === currentHour,
          hasData: true
        })
      }
      
      return data
    }

    // Use initial data if available, otherwise generate mock data
    if (initialData && initialData.length > 0) {
      setData(initialData)
      // Auto-select current hour if it's today
      const now = new Date()
      if (selectedDate.toDateString() === now.toDateString()) {
        setSelectedHour(now.getHours())
      }
    } else {
      // Generate mock data for development/demo
      const mockData = generateMockHourlySales()
      setData(mockData)
    }
  }, [initialData, selectedDate])
  
  const maxSales = Math.max(
    ...data.map(h => Math.max(h.currentSales, h.previousWeekSales))
  )
  
  const selectedHourData = selectedHour !== null 
    ? data.find(h => h.hour === selectedHour)
    : null
  
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-black">시간대별 매출 비교</h3>
        <Clock className="h-5 w-5 text-yellow-500" />
      </div>
      
      {/* Hourly Chart */}
      <div className="space-y-2 mb-6">
        {data.map((hourData) => (
          <div
            key={hourData.hour}
            className={`flex items-center gap-2 cursor-pointer p-2 rounded transition-colors ${
              selectedHour === hourData.hour ? 'bg-yellow-50' : 'hover:bg-gray-50'
            }`}
            onClick={() => setSelectedHour(hourData.hour)}
          >
            <div className="w-12 text-sm font-medium text-black">
              {hourData.hourLabel}
            </div>
            
            <div className="flex-1 relative h-8">
              {/* Previous week bar (gray) */}
              <div
                className="absolute top-1 h-3 bg-gray-300 rounded"
                style={{
                  width: `${(hourData.previousWeekSales / maxSales) * 100}%`
                }}
              />
              
              {/* Current bar (yellow) */}
              <div
                className="absolute bottom-1 h-3 bg-yellow-500 rounded"
                style={{
                  width: `${(hourData.currentSales / maxSales) * 100}%`
                }}
              />
            </div>
            
            <div className="w-32 text-right">
              <span className="text-sm font-medium text-black">
                ₩{hourData.currentSales.toLocaleString()}
              </span>
              <div className={`text-xs flex items-center justify-end gap-1 ${
                hourData.percentageChange >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {hourData.percentageChange >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {Math.abs(hourData.percentageChange).toFixed(1)}%
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Selected Hour Details */}
      {selectedHourData && (
        <div className="border-t pt-4">
          <h4 className="font-medium mb-3 text-black">
            {selectedHourData.hourLabel} 상세 비교
          </h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-black mb-1">이번 주</p>
              <p className="text-lg font-bold text-yellow-600">
                ₩{selectedHourData.currentSales.toLocaleString()}
              </p>
              <p className="text-xs text-black">
                거래 {selectedHourData.currentTransactionCount}건
              </p>
            </div>
            
            <div>
              <p className="text-sm text-black mb-1">지난 주</p>
              <p className="text-lg font-bold text-gray-600">
                ₩{selectedHourData.previousWeekSales.toLocaleString()}
              </p>
              <p className="text-xs text-black">
                거래 {selectedHourData.previousTransactionCount}건
              </p>
            </div>
          </div>
          
          <div className="mt-3 p-3 bg-gray-50 rounded">
            <div className="flex justify-between items-center">
              <span className="text-sm text-black">차이</span>
              <span className={`font-medium ${
                selectedHourData.difference >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {selectedHourData.difference >= 0 ? '+' : ''}
                ₩{selectedHourData.difference.toLocaleString()}
                {' '}
                ({selectedHourData.percentageChange >= 0 ? '+' : ''}
                {selectedHourData.percentageChange.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
      )}
      
      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-yellow-500 rounded" />
          <span className="text-black">이번 주</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-gray-300 rounded" />
          <span className="text-black">지난 주 동시간</span>
        </div>
      </div>
    </div>
  )
}