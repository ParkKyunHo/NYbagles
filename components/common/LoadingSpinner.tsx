import React from 'react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  message?: string
  fullScreen?: boolean
}

export default function LoadingSpinner({ 
  size = 'md', 
  message = '로딩 중...', 
  fullScreen = false 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-12 w-12',
    lg: 'h-16 w-16'
  }

  const content = (
    <div className="text-center">
      <div className={`animate-spin rounded-full border-b-2 border-bagel-yellow mx-auto ${sizeClasses[size]}`}></div>
      {message && (
        <p className={`mt-4 text-gray-600 ${size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-lg' : ''}`}>
          {message}
        </p>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        {content}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-8">
      {content}
    </div>
  )
}