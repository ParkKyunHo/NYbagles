/**
 * Authentication Fixture
 * 인증 관련 테스트 헬퍼
 */

import { Page, BrowserContext } from '@playwright/test'
import { delay } from './base.fixture'

export class AuthFixture {
  constructor(
    private page: Page,
    private context: BrowserContext
  ) {}

  /**
   * Login with credentials
   */
  async login(email: string, password: string): Promise<void> {
    await this.page.goto('/login')
    await this.page.waitForLoadState('networkidle')
    await delay(1000)

    // Fill login form
    await this.page.fill('[data-testid="email-input"]', email)
    await delay(1000)
    
    await this.page.fill('[data-testid="password-input"]', password)
    await delay(1000)
    
    // Click login button
    await this.page.click('[data-testid="login-button"]')
    await delay(1000)
    
    // Wait for redirect to dashboard
    await this.page.waitForURL('**/dashboard/**', { timeout: 10000 })
    await this.page.waitForLoadState('networkidle')
    await delay(1000)
  }

  /**
   * Login as admin
   */
  async loginAsAdmin(): Promise<void> {
    await this.login('admin@nybagels.com', 'Admin123456!')
  }

  /**
   * Login as manager
   */
  async loginAsManager(): Promise<void> {
    await this.login('manager@nybagels.com', 'Manager123456!')
  }

  /**
   * Login as employee
   */
  async loginAsEmployee(): Promise<void> {
    await this.login('employee@nybagels.com', 'Employee123456!')
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    // Click user menu
    await this.page.click('[data-testid="user-menu"]')
    await delay(1000)
    
    // Click logout
    await this.page.click('[data-testid="logout-button"]')
    await delay(1000)
    
    // Wait for redirect to login
    await this.page.waitForURL('**/login', { timeout: 10000 })
    await delay(1000)
  }

  /**
   * Check if user is logged in
   */
  async isLoggedIn(): Promise<boolean> {
    try {
      await this.page.waitForSelector('[data-testid="user-menu"]', { 
        timeout: 5000,
        state: 'visible' 
      })
      return true
    } catch {
      return false
    }
  }

  /**
   * Get current user info
   */
  async getCurrentUser(): Promise<{
    email: string
    role: string
  } | null> {
    if (!await this.isLoggedIn()) {
      return null
    }

    const userInfo = await this.page.evaluate(() => {
      const userElement = document.querySelector('[data-testid="user-info"]')
      if (!userElement) return null
      
      return {
        email: userElement.getAttribute('data-email') || '',
        role: userElement.getAttribute('data-role') || ''
      }
    })

    return userInfo
  }

  /**
   * Setup auth state from storage
   */
  async setupAuthState(storageState: string): Promise<void> {
    await this.context.addCookies(JSON.parse(storageState).cookies)
    await this.page.reload()
    await delay(1000)
  }

  /**
   * Save auth state to storage
   */
  async saveAuthState(): Promise<string> {
    const state = await this.context.storageState()
    return JSON.stringify(state)
  }

  /**
   * Clear auth state
   */
  async clearAuthState(): Promise<void> {
    await this.context.clearCookies()
    await this.page.reload()
    await delay(1000)
  }
}