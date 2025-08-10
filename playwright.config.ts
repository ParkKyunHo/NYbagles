/**
 * Playwright Configuration
 * E2E 테스트 설정 - 1초 딜레이 및 SaaS 품질 검증
 */

import { defineConfig, devices } from '@playwright/test'
import path from 'path'

const CI = process.env.CI === 'true'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: !CI, // CI에서는 순차 실행
  forbidOnly: CI,
  retries: CI ? 2 : 1,
  workers: CI ? 1 : 4,
  reporter: [
    ['html', { outputFolder: 'test-results/html' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list']
  ],
  
  use: {
    baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Custom action delay for all operations
    actionTimeout: 30000,
    navigationTimeout: 30000,
    
    // Global test ID attribute
    testIdAttribute: 'data-testid',
    
    // Browser context options
    contextOptions: {
      ignoreHTTPSErrors: true,
      permissions: ['camera', 'microphone'], // For QR scanning
    },
    
    // Default viewport
    viewport: { width: 1280, height: 720 },
  },

  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Custom launch options
        launchOptions: {
          slowMo: 1000, // 1초 딜레이 between operations
        }
      },
    },
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        launchOptions: {
          slowMo: 1000,
        }
      },
    },
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        launchOptions: {
          slowMo: 1000,
        }
      },
    },

    // Mobile browsers
    {
      name: 'mobile-chrome',
      use: { 
        ...devices['Pixel 5'],
        launchOptions: {
          slowMo: 1000,
        }
      },
    },
    {
      name: 'mobile-safari',
      use: { 
        ...devices['iPhone 12'],
        launchOptions: {
          slowMo: 1000,
        }
      },
    },
  ],

  // Web server configuration
  webServer: {
    command: CI ? 'npm run build && npm run start' : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !CI,
    timeout: 120000,
    env: {
      NODE_ENV: CI ? 'production' : 'test',
    },
  },

  // Global setup/teardown
  globalSetup: path.join(__dirname, 'tests/e2e/global-setup.ts'),
  globalTeardown: path.join(__dirname, 'tests/e2e/global-teardown.ts'),

  // Test timeout
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
})