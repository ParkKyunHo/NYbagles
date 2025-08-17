'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { detectDevice, getDeviceClasses, DeviceInfo } from '@/lib/utils/device-detection'

interface DeviceContextType {
  deviceInfo: DeviceInfo
  isLoading: boolean
  deviceClasses: string
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined)

export function DeviceProvider({ children }: { children: React.ReactNode }) {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => {
    // Initial server-safe default
    return {
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isIOS: false,
      isAndroid: false,
      isSafari: false,
      isChrome: false,
      isWebView: false,
      screenSize: 'lg',
      touchSupported: false,
      orientationSupported: false,
      cameraSupported: false
    }
  })
  const [isLoading, setIsLoading] = useState(true)
  const [deviceClasses, setDeviceClasses] = useState('')

  useEffect(() => {
    // Client-side device detection
    const device = detectDevice()
    const classes = getDeviceClasses()
    
    setDeviceInfo(device)
    setDeviceClasses(classes)
    setIsLoading(false)

    // Apply device classes to document body for global styling
    if (typeof document !== 'undefined') {
      document.body.className = `${document.body.className} ${classes}`.trim()
      
      // Add data attributes for CSS targeting
      document.documentElement.setAttribute('data-device-mobile', device.isMobile.toString())
      document.documentElement.setAttribute('data-device-ios', device.isIOS.toString())
      document.documentElement.setAttribute('data-device-android', device.isAndroid.toString())
      document.documentElement.setAttribute('data-device-touch', device.touchSupported.toString())
      document.documentElement.setAttribute('data-screen-size', device.screenSize)
    }

    // Listen for orientation changes on mobile devices
    if (device.isMobile && device.orientationSupported) {
      const handleOrientationChange = () => {
        // Small delay to allow screen to stabilize
        setTimeout(() => {
          const updatedDevice = detectDevice()
          setDeviceInfo(updatedDevice)
        }, 100)
      }

      window.addEventListener('orientationchange', handleOrientationChange)
      window.addEventListener('resize', handleOrientationChange)

      return () => {
        window.removeEventListener('orientationchange', handleOrientationChange)
        window.removeEventListener('resize', handleOrientationChange)
      }
    }
  }, [])

  return (
    <DeviceContext.Provider value={{ deviceInfo, isLoading, deviceClasses }}>
      {children}
    </DeviceContext.Provider>
  )
}

export function useDevice() {
  const context = useContext(DeviceContext)
  if (context === undefined) {
    throw new Error('useDevice must be used within a DeviceProvider')
  }
  return context
}

// Convenience hooks for common checks
export function useMobileDevice() {
  const { deviceInfo } = useDevice()
  return deviceInfo.isMobile
}

export function useIOSDevice() {
  const { deviceInfo } = useDevice()
  return deviceInfo.isIOS
}

export function useDesktopDevice() {
  const { deviceInfo } = useDevice()
  return deviceInfo.isDesktop
}

export function useTouchDevice() {
  const { deviceInfo } = useDevice()
  return deviceInfo.touchSupported
}