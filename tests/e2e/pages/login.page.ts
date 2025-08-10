/**
 * Login Page Object
 * 로그인 페이지 객체 모델
 */

import { Page } from '@playwright/test'
import { delay } from '../fixtures/base.fixture'

export class LoginPage {
  private page: Page

  constructor(page: Page) {
    this.page = page
  }

  // Selectors
  private selectors = {
    emailInput: '[data-testid="email-input"]',
    passwordInput: '[data-testid="password-input"]',
    loginButton: '[data-testid="login-button"]',
    errorMessage: '[data-testid="error-message"]',
    forgotPasswordLink: '[data-testid="forgot-password-link"]',
    signupLink: '[data-testid="signup-link"]',
    rememberMeCheckbox: '[data-testid="remember-me"]',
    loadingSpinner: '[data-testid="loading-spinner"]'
  }

  /**
   * Navigate to login page
   */
  async goto(): Promise<void> {
    await this.page.goto('/login')
    await this.page.waitForLoadState('networkidle')
    await delay(1000)
  }

  /**
   * Fill email field
   */
  async fillEmail(email: string): Promise<void> {
    await this.page.waitForSelector(this.selectors.emailInput, { state: 'visible' })
    await delay(1000)
    await this.page.fill(this.selectors.emailInput, email)
    await delay(1000)
  }

  /**
   * Fill password field
   */
  async fillPassword(password: string): Promise<void> {
    await this.page.waitForSelector(this.selectors.passwordInput, { state: 'visible' })
    await delay(1000)
    await this.page.fill(this.selectors.passwordInput, password)
    await delay(1000)
  }

  /**
   * Click login button
   */
  async clickLogin(): Promise<void> {
    await this.page.waitForSelector(this.selectors.loginButton, { state: 'visible' })
    await delay(1000)
    await this.page.click(this.selectors.loginButton)
    await delay(1000)
  }

  /**
   * Perform complete login
   */
  async login(email: string, password: string): Promise<void> {
    await this.fillEmail(email)
    await this.fillPassword(password)
    await this.clickLogin()
    
    // Wait for either success (redirect) or error
    await Promise.race([
      this.page.waitForURL('**/dashboard/**', { timeout: 10000 }),
      this.page.waitForSelector(this.selectors.errorMessage, { timeout: 10000 })
    ])
    
    await delay(1000)
  }

  /**
   * Check if login was successful
   */
  async isLoginSuccessful(): Promise<boolean> {
    try {
      await this.page.waitForURL('**/dashboard/**', { timeout: 5000 })
      return true
    } catch {
      return false
    }
  }

  /**
   * Get error message
   */
  async getErrorMessage(): Promise<string | null> {
    try {
      const element = await this.page.waitForSelector(this.selectors.errorMessage, { 
        timeout: 5000 
      })
      return await element.textContent()
    } catch {
      return null
    }
  }

  /**
   * Check remember me checkbox
   */
  async checkRememberMe(): Promise<void> {
    await this.page.waitForSelector(this.selectors.rememberMeCheckbox, { state: 'visible' })
    await delay(1000)
    await this.page.check(this.selectors.rememberMeCheckbox)
    await delay(1000)
  }

  /**
   * Click forgot password link
   */
  async clickForgotPassword(): Promise<void> {
    await this.page.waitForSelector(this.selectors.forgotPasswordLink, { state: 'visible' })
    await delay(1000)
    await this.page.click(this.selectors.forgotPasswordLink)
    await delay(1000)
  }

  /**
   * Click signup link
   */
  async clickSignup(): Promise<void> {
    await this.page.waitForSelector(this.selectors.signupLink, { state: 'visible' })
    await delay(1000)
    await this.page.click(this.selectors.signupLink)
    await delay(1000)
  }

  /**
   * Check if loading
   */
  async isLoading(): Promise<boolean> {
    try {
      await this.page.waitForSelector(this.selectors.loadingSpinner, { 
        state: 'visible',
        timeout: 1000 
      })
      return true
    } catch {
      return false
    }
  }

  /**
   * Wait for page to be ready
   */
  async waitForReady(): Promise<void> {
    await this.page.waitForSelector(this.selectors.emailInput, { state: 'visible' })
    await this.page.waitForSelector(this.selectors.passwordInput, { state: 'visible' })
    await this.page.waitForSelector(this.selectors.loginButton, { state: 'visible' })
    await delay(1000)
  }
}