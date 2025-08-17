/**
 * Device detection utilities for distinguishing mobile from desktop environments
 * Optimized for the bagel shop system's mobile-first approach
 */

export interface DeviceInfo {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isIOS: boolean
  isAndroid: boolean
  isSafari: boolean
  isChrome: boolean
  isWebView: boolean
  screenSize: 'sm' | 'md' | 'lg' | 'xl'
  touchSupported: boolean
  orientationSupported: boolean
  cameraSupported: boolean
}

/**
 * Comprehensive device detection
 * Uses multiple detection methods for accuracy
 */
export function detectDevice(): DeviceInfo {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    // Server-side fallback
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
  }

  const userAgent = navigator.userAgent.toLowerCase()
  const platform = navigator.platform?.toLowerCase() || ''
  
  // Screen detection
  const screenWidth = window.screen?.width || window.innerWidth || 1024
  const screenHeight = window.screen?.height || window.innerHeight || 768
  
  // Touch capability
  const touchSupported = 'ontouchstart' in window || 
    navigator.maxTouchPoints > 0 || 
    (navigator as any).msMaxTouchPoints > 0

  // Orientation support
  const orientationSupported = 'orientation' in screen || 'orientation' in window

  // Camera support detection
  const cameraSupported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)

  // OS Detection
  const isIOS = /ipad|iphone|ipod/.test(userAgent) || 
    (platform === 'macintel' && touchSupported) // iPad Pro detection

  const isAndroid = /android/.test(userAgent)

  // Browser Detection
  const isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent)
  const isChrome = /chrome/.test(userAgent) && !/edg/.test(userAgent)

  // WebView Detection
  const isWebView = (isIOS && !isSafari && !/crios/.test(userAgent)) ||
    (isAndroid && /wv/.test(userAgent))

  // Mobile Device Detection (multiple methods for accuracy)
  const mobileUserAgents = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/
  const mobileByUserAgent = mobileUserAgents.test(userAgent)
  const mobileByScreen = screenWidth <= 768 || screenHeight <= 768
  const mobileByTouch = touchSupported && (screenWidth <= 1024)

  // Tablet Detection
  const tabletUserAgents = /ipad|tablet|android.*tablet|kindle|silk/
  const tabletByUserAgent = tabletUserAgents.test(userAgent)
  const tabletByScreen = (screenWidth >= 768 && screenWidth <= 1024) && touchSupported

  const isTablet = tabletByUserAgent || tabletByScreen
  const isMobile = (mobileByUserAgent || mobileByScreen || mobileByTouch) && !isTablet
  const isDesktop = !isMobile && !isTablet

  // Screen size classification
  let screenSize: 'sm' | 'md' | 'lg' | 'xl' = 'lg'
  if (screenWidth < 640) screenSize = 'sm'
  else if (screenWidth < 768) screenSize = 'md'
  else if (screenWidth < 1024) screenSize = 'lg'
  else screenSize = 'xl'

  return {
    isMobile,
    isTablet,
    isDesktop,
    isIOS,
    isAndroid,
    isSafari,
    isChrome,
    isWebView,
    screenSize,
    touchSupported,
    orientationSupported,
    cameraSupported
  }
}

/**
 * Simplified mobile detection for quick checks
 */
export function isMobileDevice(): boolean {
  const device = detectDevice()
  return device.isMobile
}

/**
 * Check if device is iOS (iPhone/iPad)
 */
export function isIOSDevice(): boolean {
  const device = detectDevice()
  return device.isIOS
}

/**
 * Check if device supports camera
 */
export function isCameraSupported(): boolean {
  const device = detectDevice()
  return device.cameraSupported
}

/**
 * Get optimal camera constraints for device
 */
export function getOptimalCameraConstraints(): MediaTrackConstraints {
  const device = detectDevice()
  
  if (device.isIOS) {
    // iOS-specific optimizations for better camera performance
    return {
      facingMode: 'environment',
      width: { ideal: 1280, max: 1280 },
      height: { ideal: 720, max: 720 },
      aspectRatio: { ideal: 16/9 },
      frameRate: { ideal: 15, max: 24 }, // Lower for iOS stability
      // Extended constraints with type casting for non-standard properties
      ...(device.isIOS && {
        resizeMode: 'crop-and-scale' as any,
        focusMode: 'continuous' as any,
        exposureMode: 'continuous' as any,
        whiteBalanceMode: 'continuous' as any
      })
    }
  }
  
  if (device.isAndroid) {
    // Android-specific optimizations
    return {
      facingMode: 'environment',
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      aspectRatio: { ideal: 16/9 },
      frameRate: { ideal: 20, max: 30 },
      // Extended constraints with type casting for non-standard properties
      ...(device.isAndroid && {
        focusMode: 'continuous' as any,
        exposureMode: 'continuous' as any
      })
    }
  }
  
  // Desktop/other devices
  return {
    facingMode: 'environment',
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
    aspectRatio: { ideal: 16/9 },
    frameRate: { ideal: 25, max: 30 }
  }
}

/**
 * React hook for device detection with automatic updates
 */
export function useDeviceDetection() {
  if (typeof window === 'undefined') {
    // Server-side rendering fallback
    return {
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isIOS: false,
      isAndroid: false,
      isSafari: false,
      isChrome: false,
      isWebView: false,
      screenSize: 'lg' as const,
      touchSupported: false,
      orientationSupported: false,
      cameraSupported: false
    }
  }

  // For client-side, return the detection result
  return detectDevice()
}

/**
 * CSS class generator based on device type
 */
export function getDeviceClasses(): string {
  const device = detectDevice()
  const classes: string[] = []
  
  if (device.isMobile) classes.push('device-mobile')
  if (device.isTablet) classes.push('device-tablet')
  if (device.isDesktop) classes.push('device-desktop')
  if (device.isIOS) classes.push('device-ios')
  if (device.isAndroid) classes.push('device-android')
  if (device.touchSupported) classes.push('device-touch')
  if (device.cameraSupported) classes.push('device-camera')
  
  classes.push(`device-${device.screenSize}`)
  
  return classes.join(' ')
}