/**
 * 성능 최적화 유틸리티
 * 번들 사이즈, 이미지, 렌더링 최적화
 */

import dynamic from 'next/dynamic'
import { ComponentType, lazy, Suspense } from 'react'

/**
 * 동적 임포트 헬퍼 - 코드 스플리팅
 */
export function lazyLoad<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: React.ReactElement
) {
  const Component = dynamic(importFn, {
    loading: () => fallback,
    ssr: false // 클라이언트 사이드만
  })
  return Component
}

/**
 * 이미지 최적화 설정
 */
export const imageOptimization = {
  quality: 85,
  formats: ['webp', 'avif'],
  deviceSizes: [640, 750, 828, 1080, 1200],
  imageSizes: [16, 32, 48, 64, 96, 128, 256],
  minimumCacheTTL: 60 * 60 * 24 * 30 // 30일
}

/**
 * 디바운스 헬퍼 - 입력 최적화
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

/**
 * 쓰로틀 헬퍼 - 스크롤/리사이즈 최적화
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  
  return function(...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

/**
 * 메모이제이션 헬퍼 - 계산 최적화
 */
export function memoize<T extends (...args: any[]) => any>(fn: T): T {
  const cache = new Map()
  
  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args)
    if (cache.has(key)) {
      return cache.get(key)
    }
    const result = fn(...args)
    cache.set(key, result)
    return result
  }) as T
}

/**
 * 가상 스크롤링 헬퍼 - 대량 리스트 최적화
 */
export interface VirtualScrollConfig {
  itemHeight: number
  containerHeight: number
  buffer?: number
}

export function calculateVisibleRange(
  scrollTop: number,
  totalItems: number,
  config: VirtualScrollConfig
) {
  const { itemHeight, containerHeight, buffer = 3 } = config
  
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer)
  const endIndex = Math.min(
    totalItems - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + buffer
  )
  
  return { startIndex, endIndex }
}

/**
 * 프리페치 헬퍼 - 데이터 사전 로딩
 */
export async function prefetchData(urls: string[]) {
  const promises = urls.map(url => 
    fetch(url, { 
      method: 'GET',
      headers: { 'Purpose': 'prefetch' }
    }).catch(err => console.warn(`Prefetch failed for ${url}:`, err))
  )
  
  await Promise.allSettled(promises)
}

/**
 * 웹 워커 헬퍼 - CPU 집약적 작업 오프로딩
 */
export function createWorker(workerFunction: Function): Worker {
  const blob = new Blob([`(${workerFunction.toString()})()`], {
    type: 'application/javascript'
  })
  const url = URL.createObjectURL(blob)
  return new Worker(url)
}

/**
 * 성능 모니터링 헬퍼
 */
export function measurePerformance(name: string, fn: () => void | Promise<void>) {
  const start = performance.now()
  const result = fn()
  
  if (result instanceof Promise) {
    return result.finally(() => {
      const duration = performance.now() - start
      console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`)
    })
  }
  
  const duration = performance.now() - start
  console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`)
  return result
}

/**
 * Core Web Vitals 추적
 */
export function trackWebVitals() {
  if (typeof window === 'undefined') return
  
  // LCP (Largest Contentful Paint)
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      console.log('[CWV] LCP:', entry.startTime)
    }
  }).observe({ type: 'largest-contentful-paint', buffered: true })
  
  // FID (First Input Delay)
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const delay = entry.processingStart - entry.startTime
      console.log('[CWV] FID:', delay)
    }
  }).observe({ type: 'first-input', buffered: true })
  
  // CLS (Cumulative Layout Shift)
  let clsValue = 0
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!(entry as any).hadRecentInput) {
        clsValue += (entry as any).value
        console.log('[CWV] CLS:', clsValue)
      }
    }
  }).observe({ type: 'layout-shift', buffered: true })
}