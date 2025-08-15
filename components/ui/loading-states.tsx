import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  message?: string
}

export function LoadingSpinner({ size = 'md', className = '', message }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  }

  return (
    <div className={`flex flex-col items-center justify-center space-y-4 ${className}`}>
      <Loader2 className={`${sizeClasses[size]} animate-spin text-bagel-yellow`} />
      {message && (
        <p className="text-sm text-gray-600 animate-pulse">{message}</p>
      )}
    </div>
  )
}

interface PageLoadingProps {
  message?: string
}

export function PageLoading({ message = '데이터를 불러오는 중...' }: PageLoadingProps) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <div className="relative">
          <div className="w-20 h-20 mx-auto mb-4">
            <div className="absolute inset-0 bg-bagel-yellow rounded-full animate-ping opacity-20" />
            <div className="relative w-20 h-20 bg-bagel-yellow rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-2xl">N</span>
            </div>
          </div>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">{message}</h3>
        <div className="flex items-center justify-center space-x-1">
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            className="w-2 h-2 bg-bagel-yellow rounded-full"
          />
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
            className="w-2 h-2 bg-bagel-yellow rounded-full"
          />
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
            className="w-2 h-2 bg-bagel-yellow rounded-full"
          />
        </div>
      </motion.div>
    </div>
  )
}

interface SectionLoadingProps {
  rows?: number
}

export function SectionLoading({ rows = 3 }: SectionLoadingProps) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-white rounded-lg shadow p-6">
          <div className="animate-pulse">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gray-200 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

interface DataLoadingProps {
  type: 'table' | 'cards' | 'list'
  items?: number
}

export function DataLoading({ type, items = 5 }: DataLoadingProps) {
  if (type === 'table') {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="animate-pulse">
          {/* Table Header */}
          <div className="bg-gray-50 px-6 py-3 border-b">
            <div className="flex space-x-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-4 bg-gray-200 rounded flex-1" />
              ))}
            </div>
          </div>
          {/* Table Rows */}
          {Array.from({ length: items }).map((_, i) => (
            <div key={i} className="px-6 py-4 border-b">
              <div className="flex space-x-4">
                {[1, 2, 3, 4, 5].map((j) => (
                  <div key={j} className="h-4 bg-gray-200 rounded flex-1" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (type === 'cards') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: items }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow p-6">
            <div className="animate-pulse">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded" />
                <div className="h-3 bg-gray-200 rounded w-5/6" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="bg-white rounded-lg shadow p-4">
          <div className="animate-pulse flex items-center space-x-4">
            <div className="w-10 h-10 bg-gray-200 rounded" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
            <div className="w-20 h-8 bg-gray-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}