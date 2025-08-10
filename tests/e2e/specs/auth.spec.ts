/**
 * Authentication E2E Tests
 * 인증 시스템 E2E 테스트 - 1초 딜레이 적용
 */

import { test, expect, delay } from '../fixtures/base.fixture'
import { LoginPage } from '../pages/login.page'

test.describe('Authentication Tests', () => {
  let loginPage: LoginPage

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page)
    await loginPage.goto()
  })

  test('successful login as admin', async ({ page }) => {
    // Arrange
    const email = 'admin@nybagels.com'
    const password = 'Admin123456!'

    // Act
    await loginPage.fillEmail(email)
    await delay(1000)
    
    await loginPage.fillPassword(password)
    await delay(1000)
    
    await loginPage.clickLogin()
    await delay(1000)

    // Assert
    await expect(page).toHaveURL(/.*dashboard.*/)
    await delay(1000)
    
    // Verify user menu is visible
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()
    await delay(1000)
    
    // Verify role display
    await expect(page.locator('[data-testid="user-role"]')).toContainText('Admin')
  })

  test('successful login as manager', async ({ page }) => {
    // Arrange
    const email = 'manager@nybagels.com'
    const password = 'Manager123456!'

    // Act
    await loginPage.login(email, password)
    await delay(1000)

    // Assert
    await expect(page).toHaveURL(/.*dashboard.*/)
    await expect(page.locator('[data-testid="user-role"]')).toContainText('Manager')
  })

  test('successful login as employee', async ({ page }) => {
    // Arrange
    const email = 'employee@nybagels.com'
    const password = 'Employee123456!'

    // Act
    await loginPage.login(email, password)
    await delay(1000)

    // Assert
    await expect(page).toHaveURL(/.*dashboard.*/)
    await expect(page.locator('[data-testid="user-role"]')).toContainText('Employee')
  })

  test('failed login with invalid credentials', async ({ page }) => {
    // Arrange
    const email = 'invalid@test.com'
    const password = 'WrongPassword123!'

    // Act
    await loginPage.fillEmail(email)
    await delay(1000)
    
    await loginPage.fillPassword(password)
    await delay(1000)
    
    await loginPage.clickLogin()
    await delay(1000)

    // Assert
    const errorMessage = await loginPage.getErrorMessage()
    expect(errorMessage).toContain('Invalid login credentials')
    await delay(1000)
    
    // Should stay on login page
    await expect(page).toHaveURL(/.*login.*/)
  })

  test('failed login with empty fields', async ({ page }) => {
    // Act - Click login without filling fields
    await loginPage.clickLogin()
    await delay(1000)

    // Assert
    await expect(page.locator('[data-testid="email-error"]')).toBeVisible()
    await expect(page.locator('[data-testid="password-error"]')).toBeVisible()
    await delay(1000)
    
    // Should stay on login page
    await expect(page).toHaveURL(/.*login.*/)
  })

  test('remember me functionality', async ({ page, context }) => {
    // Arrange
    const email = 'employee@nybagels.com'
    const password = 'Employee123456!'

    // Act
    await loginPage.fillEmail(email)
    await delay(1000)
    
    await loginPage.fillPassword(password)
    await delay(1000)
    
    await loginPage.checkRememberMe()
    await delay(1000)
    
    await loginPage.clickLogin()
    await delay(1000)

    // Assert - Check if logged in
    await expect(page).toHaveURL(/.*dashboard.*/)
    await delay(1000)

    // Get cookies
    const cookies = await context.cookies()
    const authCookie = cookies.find(c => c.name.includes('auth'))
    
    // Check cookie expiry (should be longer than session)
    expect(authCookie).toBeDefined()
    if (authCookie) {
      const expiryDate = new Date(authCookie.expires * 1000)
      const now = new Date()
      const daysDiff = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      expect(daysDiff).toBeGreaterThan(1) // Should remember for more than 1 day
    }
  })

  test('logout functionality', async ({ page, auth }) => {
    // Arrange - Login first
    await auth.loginAsEmployee()
    await delay(1000)

    // Act - Logout
    await page.click('[data-testid="user-menu"]')
    await delay(1000)
    
    await page.click('[data-testid="logout-button"]')
    await delay(1000)

    // Assert
    await expect(page).toHaveURL(/.*login.*/)
    await delay(1000)
    
    // Try to access protected route
    await page.goto('/dashboard')
    await delay(1000)
    
    // Should redirect to login
    await expect(page).toHaveURL(/.*login.*/)
  })

  test('session persistence across page refresh', async ({ page, auth }) => {
    // Arrange - Login
    await auth.loginAsManager()
    await delay(1000)

    // Act - Refresh page
    await page.reload()
    await delay(1000)

    // Assert - Should still be logged in
    await expect(page).toHaveURL(/.*dashboard.*/)
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()
    await expect(page.locator('[data-testid="user-role"]')).toContainText('Manager')
  })

  test('role-based access control', async ({ page, auth }) => {
    // Test employee trying to access admin page
    await auth.loginAsEmployee()
    await delay(1000)

    // Try to access admin-only page
    await page.goto('/admin/system-settings')
    await delay(1000)

    // Should show unauthorized or redirect
    const unauthorizedMessage = page.locator('[data-testid="unauthorized-message"]')
    const isUnauthorized = await unauthorizedMessage.isVisible()
    
    if (isUnauthorized) {
      await expect(unauthorizedMessage).toContainText('권한이 없습니다')
    } else {
      // Or redirected to dashboard
      await expect(page).toHaveURL(/.*dashboard.*/)
    }
  })

  test('password visibility toggle', async ({ page }) => {
    // Arrange
    const password = 'TestPassword123!'
    
    // Act - Type password
    await loginPage.fillPassword(password)
    await delay(1000)
    
    // Check initial state (should be password type)
    const passwordInput = page.locator('[data-testid="password-input"]')
    await expect(passwordInput).toHaveAttribute('type', 'password')
    await delay(1000)
    
    // Toggle visibility
    await page.click('[data-testid="password-toggle"]')
    await delay(1000)
    
    // Assert - Should be visible
    await expect(passwordInput).toHaveAttribute('type', 'text')
    await delay(1000)
    
    // Toggle back
    await page.click('[data-testid="password-toggle"]')
    await delay(1000)
    
    // Should be hidden again
    await expect(passwordInput).toHaveAttribute('type', 'password')
  })
})