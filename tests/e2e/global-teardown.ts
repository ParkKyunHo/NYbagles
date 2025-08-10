/**
 * Global Teardown for Playwright Tests
 * 테스트 실행 후 정리
 */

import { FullConfig } from '@playwright/test'
import fs from 'fs'
import path from 'path'

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global test teardown...')
  
  try {
    // Clean up auth states if needed
    const authDir = 'test-results/auth'
    if (fs.existsSync(authDir)) {
      console.log('🗑️ Cleaning up auth states...')
      // Optionally keep auth states for debugging
      // fs.rmSync(authDir, { recursive: true, force: true })
    }
    
    // Generate test report summary
    const resultsFile = 'test-results/results.json'
    if (fs.existsSync(resultsFile)) {
      console.log('📊 Generating test summary...')
      const results = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'))
      
      // Calculate statistics
      const stats = {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0
      }
      
      if (results.suites) {
        results.suites.forEach((suite: any) => {
          suite.specs?.forEach((spec: any) => {
            stats.total++
            if (spec.ok) stats.passed++
            else stats.failed++
            stats.duration += spec.duration || 0
          })
        })
      }
      
      console.log('📈 Test Results:')
      console.log(`   Total: ${stats.total}`)
      console.log(`   ✅ Passed: ${stats.passed}`)
      console.log(`   ❌ Failed: ${stats.failed}`)
      console.log(`   ⏱️ Duration: ${(stats.duration / 1000).toFixed(2)}s`)
      
      // Save summary
      fs.writeFileSync(
        'test-results/summary.json',
        JSON.stringify(stats, null, 2)
      )
    }
    
    // Archive screenshots and videos if tests failed
    const screenshotsDir = 'test-results/screenshots'
    const videosDir = 'test-results/videos'
    
    if (fs.existsSync(screenshotsDir)) {
      const screenshots = fs.readdirSync(screenshotsDir)
      if (screenshots.length > 0) {
        console.log(`📸 Found ${screenshots.length} screenshots`)
      }
    }
    
    if (fs.existsSync(videosDir)) {
      const videos = fs.readdirSync(videosDir)
      if (videos.length > 0) {
        console.log(`🎥 Found ${videos.length} videos`)
      }
    }
    
  } catch (error) {
    console.error('❌ Global teardown error:', error)
    // Don't throw - allow tests to complete
  }
  
  console.log('✅ Global teardown completed')
}

export default globalTeardown