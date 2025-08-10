/**
 * Base Test Fixture
 * 기본 테스트 픽스처 - 1초 딜레이 및 공통 기능
 */

import { test as base, expect } from '@playwright/test'
import { AuthFixture } from './auth.fixture'
import { DatabaseFixture } from './database.fixture'

// Custom delay function
export const delay = (ms: number = 1000) => new Promise(resolve => setTimeout(resolve, ms))

// Custom test with fixtures
export const test = base.extend<{
  auth: AuthFixture
  db: DatabaseFixture
  delayedClick: (selector: string) => Promise<void>
  delayedType: (selector: string, text: string) => Promise<void>
  delayedNavigate: (url: string) => Promise<void>
}>({
  // Auth fixture
  auth: async ({ page, context }, use) => {
    const auth = new AuthFixture(page, context)
    await use(auth)
  },

  // Database fixture
  db: async ({}, use) => {
    const db = new DatabaseFixture()
    await db.setup()
    await use(db)
    await db.teardown()
  },

  // Delayed click with 1 second wait
  delayedClick: async ({ page }, use) => {
    const clickFn = async (selector: string) => {
      await page.waitForSelector(selector, { state: 'visible' })
      await delay(1000) // 1초 대기
      await page.click(selector)
      await delay(1000) // 클릭 후 1초 대기
    }
    await use(clickFn)
  },

  // Delayed type with 1 second wait
  delayedType: async ({ page }, use) => {
    const typeFn = async (selector: string, text: string) => {
      await page.waitForSelector(selector, { state: 'visible' })
      await delay(1000) // 1초 대기
      await page.fill(selector, text)
      await delay(1000) // 입력 후 1초 대기
    }
    await use(typeFn)
  },

  // Delayed navigation with 1 second wait
  delayedNavigate: async ({ page }, use) => {
    const navigateFn = async (url: string) => {
      await delay(1000) // 네비게이션 전 1초 대기
      await page.goto(url)
      await page.waitForLoadState('networkidle')
      await delay(1000) // 페이지 로드 후 1초 대기
    }
    await use(navigateFn)
  },
})

export { expect }

// Common selectors
export const selectors = {
  // Auth
  loginForm: '[data-testid="login-form"]',
  emailInput: '[data-testid="email-input"]',
  passwordInput: '[data-testid="password-input"]',
  loginButton: '[data-testid="login-button"]',
  logoutButton: '[data-testid="logout-button"]',
  
  // Navigation
  dashboardMenu: '[data-testid="dashboard-menu"]',
  salesMenu: '[data-testid="sales-menu"]',
  productsMenu: '[data-testid="products-menu"]',
  employeesMenu: '[data-testid="employees-menu"]',
  
  // Sales
  quickSaleButton: '[data-testid="quick-sale-button"]',
  productSelect: '[data-testid="product-select"]',
  quantityInput: '[data-testid="quantity-input"]',
  addToCartButton: '[data-testid="add-to-cart"]',
  checkoutButton: '[data-testid="checkout-button"]',
  paymentMethodSelect: '[data-testid="payment-method"]',
  completePaymentButton: '[data-testid="complete-payment"]',
  
  // Common UI
  successMessage: '[data-testid="success-message"]',
  errorMessage: '[data-testid="error-message"]',
  loadingSpinner: '[data-testid="loading-spinner"]',
  modalDialog: '[data-testid="modal-dialog"]',
  confirmButton: '[data-testid="confirm-button"]',
  cancelButton: '[data-testid="cancel-button"]',
}

// Test data helpers
export const testData = {
  // Test users
  admin: {
    email: 'admin@test.com',
    password: 'Test123456!',
    role: 'admin'
  },
  manager: {
    email: 'manager@test.com',
    password: 'Test123456!',
    role: 'manager'
  },
  employee: {
    email: 'employee@test.com',
    password: 'Test123456!',
    role: 'employee'
  },
  
  // Test products
  products: [
    { name: 'Plain Bagel', price: 3000, sku: 'BGL-001' },
    { name: 'Everything Bagel', price: 3500, sku: 'BGL-002' },
    { name: 'Sesame Bagel', price: 3500, sku: 'BGL-003' },
  ],
  
  // Test stores
  stores: [
    { name: 'Main Store', address: 'Seoul, Gangnam' },
    { name: 'Branch Store', address: 'Seoul, Hongdae' },
  ]
}

// Performance metrics helper
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map()

  startMeasure(name: string): () => void {
    const start = Date.now()
    return () => {
      const duration = Date.now() - start
      if (!this.metrics.has(name)) {
        this.metrics.set(name, [])
      }
      this.metrics.get(name)!.push(duration)
    }
  }

  getMetrics(name: string): {
    avg: number
    min: number
    max: number
    count: number
  } | null {
    const values = this.metrics.get(name)
    if (!values || values.length === 0) return null

    return {
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length
    }
  }

  getAllMetrics(): Record<string, any> {
    const result: Record<string, any> = {}
    this.metrics.forEach((values, name) => {
      result[name] = this.getMetrics(name)
    })
    return result
  }

  reset(): void {
    this.metrics.clear()
  }
}

// Error recovery helper
export async function withErrorRecovery<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    delayMs?: number
    onError?: (error: Error, attempt: number) => void
  } = {}
): Promise<T> {
  const { maxRetries = 3, delayMs = 2000, onError } = options
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (onError) {
        onError(error as Error, attempt)
      }
      
      if (attempt === maxRetries) {
        throw error
      }
      
      await delay(delayMs * attempt) // Exponential backoff
    }
  }
  
  throw new Error('Unexpected error in withErrorRecovery')
}

// Screenshot helper with annotation
export async function takeAnnotatedScreenshot(
  page: any,
  name: string,
  annotations?: Array<{ selector: string; text: string }>
): Promise<void> {
  // Add annotations if provided
  if (annotations) {
    for (const annotation of annotations) {
      await page.evaluate(({ selector, text }: { selector: string; text: string }) => {
        const element = document.querySelector(selector)
        if (element) {
          const badge = document.createElement('div')
          badge.textContent = text
          badge.style.cssText = `
            position: absolute;
            background: red;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 10000;
          `
          const rect = element.getBoundingClientRect()
          badge.style.top = `${rect.top - 30}px`
          badge.style.left = `${rect.left}px`
          document.body.appendChild(badge)
        }
      }, annotation)
    }
  }
  
  await page.screenshot({ 
    path: `test-results/screenshots/${name}-${Date.now()}.png`,
    fullPage: true 
  })
}