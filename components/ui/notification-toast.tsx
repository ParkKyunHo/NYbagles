'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

export type NotificationType = 'success' | 'error' | 'warning' | 'info'

export interface NotificationProps {
  id: string
  type: NotificationType
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info
}

const colors = {
  success: 'bg-green-50 text-green-800 border-green-200',
  error: 'bg-red-50 text-red-800 border-red-200',
  warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  info: 'bg-blue-50 text-blue-800 border-blue-200'
}

const iconColors = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-yellow-500',
  info: 'text-blue-500'
}

interface NotificationToastProps {
  notification: NotificationProps
  onClose: (id: string) => void
}

export function NotificationToast({ notification, onClose }: NotificationToastProps) {
  const Icon = icons[notification.type]
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    if (notification.duration) {
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev <= 0) {
            clearInterval(interval)
            onClose(notification.id)
            return 0
          }
          return prev - (100 / (notification.duration! / 100))
        })
      }, 100)

      return () => clearInterval(interval)
    }
  }, [notification.duration, notification.id, onClose])

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      className={`relative max-w-sm w-full shadow-lg rounded-lg border ${colors[notification.type]} overflow-hidden`}
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <Icon className={`h-5 w-5 ${iconColors[notification.type]}`} />
          </div>
          <div className="ml-3 w-0 flex-1">
            <p className="font-medium">{notification.title}</p>
            {notification.message && (
              <p className="mt-1 text-sm opacity-90">{notification.message}</p>
            )}
            {notification.action && (
              <button
                onClick={notification.action.onClick}
                className="mt-2 text-sm font-medium underline hover:no-underline"
              >
                {notification.action.label}
              </button>
            )}
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              onClick={() => onClose(notification.id)}
              className="rounded-md inline-flex text-gray-500 hover:text-gray-700 focus:outline-none"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      {notification.duration && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/10">
          <div
            className="h-full bg-current opacity-30 transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </motion.div>
  )
}

// Toast Container Component
export function NotificationContainer() {
  const [notifications, setNotifications] = useState<NotificationProps[]>([])

  useEffect(() => {
    const handleNotification = (event: CustomEvent<NotificationProps>) => {
      setNotifications((prev) => [...prev, event.detail])
    }

    window.addEventListener('notify' as any, handleNotification)
    return () => window.removeEventListener('notify' as any, handleNotification)
  }, [])

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      <AnimatePresence>
        {notifications.map((notification) => (
          <NotificationToast
            key={notification.id}
            notification={notification}
            onClose={removeNotification}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

// Helper function to trigger notifications
export function notify(props: Omit<NotificationProps, 'id'>) {
  const notification: NotificationProps = {
    ...props,
    id: Math.random().toString(36).substr(2, 9),
    duration: props.duration ?? 5000
  }
  
  window.dispatchEvent(new CustomEvent('notify', { detail: notification }))
}