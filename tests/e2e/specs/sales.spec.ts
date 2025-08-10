/**
 * Sales E2E Tests
 * 판매 시스템 E2E 테스트 - 1초 딜레이 적용
 */

import { test, expect, delay, testData, PerformanceMonitor } from '../fixtures/base.fixture'
import { SalesPage } from '../pages/sales.page'

test.describe('Sales Module Tests', () => {
  let salesPage: SalesPage
  let performanceMonitor: PerformanceMonitor

  test.beforeEach(async ({ page, auth, db }) => {
    salesPage = new SalesPage(page)
    performanceMonitor = new PerformanceMonitor()
    
    // Login as employee
    await auth.loginAsEmployee()
    await delay(1000)
    
    // Navigate to sales page
    await salesPage.gotoQuickSale()
    await delay(1000)
  })

  test.afterEach(async () => {
    // Log performance metrics
    const metrics = performanceMonitor.getAllMetrics()
    console.log('Performance Metrics:', metrics)
  })

  test('complete sale with single product', async ({ page }) => {
    // Start performance measurement
    const endMeasure = performanceMonitor.startMeasure('single-product-sale')

    // Act - Select product
    await salesPage.selectProduct('Plain Bagel')
    await delay(1000)
    
    // Set quantity
    await salesPage.setQuantity(2)
    await delay(1000)
    
    // Add to cart
    await salesPage.addToCart()
    await delay(1000)

    // Assert - Verify cart
    const cartTotal = await salesPage.getCartTotal()
    expect(cartTotal).toContain('6,000') // 3,000 × 2
    await delay(1000)

    // Proceed to checkout
    await salesPage.proceedToCheckout()
    await delay(1000)
    
    // Select payment method
    await salesPage.selectPaymentMethod('cash')
    await delay(1000)
    
    // Complete payment
    await salesPage.completePayment()
    await delay(1000)

    // Assert - Verify receipt
    const receiptNumber = await salesPage.getReceiptNumber()
    expect(receiptNumber).toBeTruthy()
    expect(receiptNumber).toMatch(/^RCP-\d+/)
    await delay(1000)

    // Close receipt
    await salesPage.closeReceipt()
    await delay(1000)

    // Verify success message
    const successMessage = await salesPage.getSuccessMessage()
    expect(successMessage).toContain('판매가 완료되었습니다')

    endMeasure()
  })

  test('complete sale with multiple products', async ({ page }) => {
    const endMeasure = performanceMonitor.startMeasure('multiple-product-sale')

    // Add first product
    await salesPage.addProductToCart('Plain Bagel', 2)
    await delay(1000)
    
    // Add second product
    await salesPage.addProductToCart('Everything Bagel', 3)
    await delay(1000)
    
    // Add third product
    await salesPage.addProductToCart('Coffee', 2)
    await delay(1000)

    // Verify cart items count
    const itemsCount = await salesPage.getCartItemsCount()
    expect(itemsCount).toBe(3)
    await delay(1000)

    // Verify total
    const cartTotal = await salesPage.getCartTotal()
    // 3000×2 + 3500×3 + 4000×2 = 6000 + 10500 + 8000 = 24500
    expect(cartTotal).toContain('24,500')
    await delay(1000)

    // Complete sale
    const receiptNumber = await salesPage.completeSale(
      [],  // Products already in cart
      'card',
      '010-1234-5678'
    )

    expect(receiptNumber).toBeTruthy()
    await delay(1000)

    // Close receipt
    await salesPage.closeReceipt()

    endMeasure()
  })

  test('remove item from cart', async ({ page }) => {
    // Add multiple products
    await salesPage.addProductToCart('Plain Bagel', 2)
    await delay(1000)
    
    await salesPage.addProductToCart('Everything Bagel', 1)
    await delay(1000)

    // Verify initial cart
    let itemsCount = await salesPage.getCartItemsCount()
    expect(itemsCount).toBe(2)
    await delay(1000)

    // Remove one item
    await salesPage.removeFromCart('Plain Bagel')
    await delay(1000)

    // Verify cart after removal
    itemsCount = await salesPage.getCartItemsCount()
    expect(itemsCount).toBe(1)
    await delay(1000)

    // Verify total updated
    const cartTotal = await salesPage.getCartTotal()
    expect(cartTotal).toContain('3,500')
  })

  test('clear entire cart', async ({ page }) => {
    // Add products
    await salesPage.addProductToCart('Plain Bagel', 3)
    await delay(1000)
    
    await salesPage.addProductToCart('Coffee', 2)
    await delay(1000)

    // Verify cart has items
    let itemsCount = await salesPage.getCartItemsCount()
    expect(itemsCount).toBe(2)
    await delay(1000)

    // Clear cart
    await salesPage.clearCart()
    await delay(1000)

    // Confirm clear in dialog
    await page.click('[data-testid="confirm-clear"]')
    await delay(1000)

    // Verify cart is empty
    itemsCount = await salesPage.getCartItemsCount()
    expect(itemsCount).toBe(0)
    await delay(1000)

    // Verify total is 0
    const cartTotal = await salesPage.getCartTotal()
    expect(cartTotal).toContain('0')
  })

  test('search product functionality', async ({ page }) => {
    // Search for specific product
    await salesPage.searchProduct('Everything')
    await delay(1000)

    // Verify search results
    const visibleProducts = await page.$$('[data-testid="product-card"]')
    expect(visibleProducts.length).toBeGreaterThan(0)
    await delay(1000)

    // Verify filtered correctly
    const productNames = await page.$$eval('[data-testid="product-card"] [data-testid="product-name"]', 
      elements => elements.map(el => el.textContent)
    )
    
    productNames.forEach(name => {
      expect(name?.toLowerCase()).toContain('everything')
    })
    await delay(1000)

    // Clear search
    await page.fill('[data-testid="product-search"]', '')
    await delay(1000)
    await page.press('[data-testid="product-search"]', 'Enter')
    await delay(1000)

    // Verify all products shown
    const allProducts = await page.$$('[data-testid="product-card"]')
    expect(allProducts.length).toBeGreaterThan(visibleProducts.length)
  })

  test('payment method selection', async ({ page }) => {
    // Add product
    await salesPage.addProductToCart('Plain Bagel', 1)
    await delay(1000)

    // Go to checkout
    await salesPage.proceedToCheckout()
    await delay(1000)

    // Test cash payment
    await salesPage.selectPaymentMethod('cash')
    await delay(1000)
    await expect(page.locator('[data-testid="cash-amount-input"]')).toBeVisible()
    await delay(1000)

    // Test card payment
    await salesPage.selectPaymentMethod('card')
    await delay(1000)
    await expect(page.locator('[data-testid="card-last4-input"]')).toBeVisible()
    await delay(1000)

    // Test transfer payment
    await salesPage.selectPaymentMethod('transfer')
    await delay(1000)
    await expect(page.locator('[data-testid="transfer-ref-input"]')).toBeVisible()
    await delay(1000)

    // Test mobile payment
    await salesPage.selectPaymentMethod('mobile')
    await delay(1000)
    await expect(page.locator('[data-testid="mobile-provider-select"]')).toBeVisible()
  })

  test('customer phone input validation', async ({ page }) => {
    // Add product and go to checkout
    await salesPage.addProductToCart('Coffee', 1)
    await delay(1000)
    
    await salesPage.proceedToCheckout()
    await delay(1000)

    // Test invalid phone format
    await salesPage.enterCustomerPhone('invalid')
    await delay(1000)
    
    await salesPage.selectPaymentMethod('cash')
    await delay(1000)
    
    await page.click('[data-testid="complete-payment"]')
    await delay(1000)

    // Should show validation error
    await expect(page.locator('[data-testid="phone-error"]')).toBeVisible()
    await expect(page.locator('[data-testid="phone-error"]')).toContainText('올바른 전화번호')
    await delay(1000)

    // Enter valid phone
    await salesPage.enterCustomerPhone('010-1234-5678')
    await delay(1000)

    // Error should disappear
    await expect(page.locator('[data-testid="phone-error"]')).not.toBeVisible()
  })

  test('stock validation', async ({ page }) => {
    // Try to add more than available stock
    await salesPage.selectProduct('Plain Bagel')
    await delay(1000)
    
    // Set very high quantity
    await salesPage.setQuantity(9999)
    await delay(1000)
    
    await salesPage.addToCart()
    await delay(1000)

    // Should show stock error
    const errorMessage = await salesPage.getErrorMessage()
    expect(errorMessage).toContain('재고가 부족합니다')
    await delay(1000)

    // Product should not be added to cart
    const itemsCount = await salesPage.getCartItemsCount()
    expect(itemsCount).toBe(0)
  })

  test('receipt printing', async ({ page }) => {
    // Complete a sale
    const receiptNumber = await salesPage.completeSale(
      [{ name: 'Plain Bagel', quantity: 1 }],
      'cash'
    )
    await delay(1000)

    // Mock print dialog
    await page.evaluateHandle(() => {
      window.print = () => {
        console.log('Print dialog opened')
        return true
      }
    })

    // Click print
    await salesPage.printReceipt()
    await delay(1000)

    // Verify print was triggered (in real scenario, would check print preview)
    // For now, just verify button was clickable
    await expect(page.locator('[data-testid="print-receipt"]')).toBeEnabled()
  })

  test('sales history navigation', async ({ page }) => {
    // Complete a sale first
    await salesPage.completeSale(
      [{ name: 'Coffee', quantity: 1 }],
      'card'
    )
    await delay(1000)
    
    await salesPage.closeReceipt()
    await delay(1000)

    // Navigate to history
    await page.click('[data-testid="history-tab"]')
    await delay(1000)

    // Verify history page loaded
    await expect(page).toHaveURL(/.*sales\/history.*/)
    await delay(1000)

    // Verify recent sale appears
    await expect(page.locator('[data-testid="sales-table"]')).toBeVisible()
    await delay(1000)
    
    const rows = await page.$$('[data-testid="sales-row"]')
    expect(rows.length).toBeGreaterThan(0)
  })

  test('performance - complete sale under 30 seconds', async ({ page }) => {
    const startTime = Date.now()

    // Complete full sale flow
    await salesPage.completeSale(
      [
        { name: 'Plain Bagel', quantity: 2 },
        { name: 'Coffee', quantity: 1 }
      ],
      'card',
      '010-9876-5432'
    )

    const endTime = Date.now()
    const duration = (endTime - startTime) / 1000

    // Assert - Should complete within 30 seconds including all delays
    expect(duration).toBeLessThan(30)
    
    console.log(`Sale completed in ${duration.toFixed(2)} seconds`)
  })
})