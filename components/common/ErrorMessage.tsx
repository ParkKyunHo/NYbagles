import React from 'react'
import { AlertCircle, XCircle } from 'lucide-react'

interface ErrorMessageProps {
  title?: string
  message: string
  type?: 'error' | 'warning'
  onClose?: () => void
}

export default function ErrorMessage({ 
  title, 
  message, 
  type = 'error',
  onClose 
}: ErrorMessageProps) {
  const colorClasses = {
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      icon: 'text-red-600'
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-800',
      icon: 'text-yellow-600'
    }
  }

  const colors = colorClasses[type]
  const Icon = type === 'error' ? XCircle : AlertCircle

  return (
    <div className={`mb-6 ${colors.bg} border ${colors.border} rounded-md p-4`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <Icon className={`h-5 w-5 ${colors.icon}`} />
        </div>
        <div className="ml-3 flex-1">
          {title && (
            <h3 className={`text-sm font-medium ${colors.text}`}>{title}</h3>
          )}
          <div className={`text-sm ${colors.text} ${title ? 'mt-2' : ''}`}>
            <p>{message}</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className={`ml-3 ${colors.text} hover:opacity-70`}
          >
            <span className="sr-only">닫기</span>
            <XCircle className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  )
}