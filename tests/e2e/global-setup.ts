/**
 * Global Setup for Playwright Tests
 * 테스트 실행 전 전역 설정
 */

import { chromium, FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global test setup...')
  
  // Create browser for setup
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  
  try {
    // Set up test environment
    const baseURL = config.projects[0].use.baseURL || 'http://localhost:3000'
    
    // Check if server is running
    console.log('🔍 Checking server availability...')
    await page.goto(baseURL, { timeout: 30000 })
    console.log('✅ Server is running')
    
    // Optionally create auth states for different roles
    console.log('🔐 Creating auth states...')
    
    // Admin auth state
    await page.goto(`${baseURL}/login`)
    await page.fill('[data-testid="email-input"]', 'admin@nybagels.com')
    await page.fill('[data-testid="password-input"]', 'Admin123456!')
    await page.click('[data-testid="login-button"]')
    await page.waitForURL('**/dashboard/**', { timeout: 10000 })
    await context.storageState({ path: 'test-results/auth/admin.json' })
    console.log('✅ Admin auth state created')
    
    // Clear cookies for next auth
    await context.clearCookies()
    
    // Manager auth state
    await page.goto(`${baseURL}/login`)
    await page.fill('[data-testid="email-input"]', 'manager@nybagels.com')
    await page.fill('[data-testid="password-input"]', 'Manager123456!')
    await page.click('[data-testid="login-button"]')
    await page.waitForURL('**/dashboard/**', { timeout: 10000 })
    await context.storageState({ path: 'test-results/auth/manager.json' })
    console.log('✅ Manager auth state created')
    
    // Clear cookies for next auth
    await context.clearCookies()
    
    // Employee auth state
    await page.goto(`${baseURL}/login`)
    await page.fill('[data-testid="email-input"]', 'employee@nybagels.com')
    await page.fill('[data-testid="password-input"]', 'Employee123456!')
    await page.click('[data-testid="login-button"]')
    await page.waitForURL('**/dashboard/**', { timeout: 10000 })
    await context.storageState({ path: 'test-results/auth/employee.json' })
    console.log('✅ Employee auth state created')
    
  } catch (error) {
    console.error('❌ Global setup failed:', error)
    throw error
  } finally {
    await browser.close()
  }
  
  console.log('✅ Global setup completed successfully')
}

export default globalSetup