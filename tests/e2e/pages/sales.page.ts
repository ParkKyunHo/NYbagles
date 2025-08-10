/**
 * Sales Page Object
 * 판매 페이지 객체 모델
 */

import { Page } from '@playwright/test'
import { delay } from '../fixtures/base.fixture'

export class SalesPage {
  private page: Page

  constructor(page: Page) {
    this.page = page
  }

  // Selectors
  private selectors = {
    // Navigation
    salesMenu: '[data-testid="sales-menu"]',
    quickSaleTab: '[data-testid="quick-sale-tab"]',
    historyTab: '[data-testid="history-tab"]',
    summaryTab: '[data-testid="summary-tab"]',
    
    // Quick Sale
    productSearch: '[data-testid="product-search"]',
    productCard: '[data-testid="product-card"]',
    quantityInput: '[data-testid="quantity-input"]',
    addToCartButton: '[data-testid="add-to-cart"]',
    cartItem: '[data-testid="cart-item"]',
    cartTotal: '[data-testid="cart-total"]',
    removeFromCart: '[data-testid="remove-from-cart"]',
    clearCartButton: '[data-testid="clear-cart"]',
    
    // Checkout
    checkoutButton: '[data-testid="checkout-button"]',
    paymentMethodSelect: '[data-testid="payment-method"]',
    customerPhoneInput: '[data-testid="customer-phone"]',
    notesInput: '[data-testid="notes-input"]',
    completePaymentButton: '[data-testid="complete-payment"]',
    cancelPaymentButton: '[data-testid="cancel-payment"]',
    
    // Receipt
    receiptModal: '[data-testid="receipt-modal"]',
    receiptNumber: '[data-testid="receipt-number"]',
    printReceiptButton: '[data-testid="print-receipt"]',
    closeReceiptButton: '[data-testid="close-receipt"]',
    
    // Messages
    successMessage: '[data-testid="success-message"]',
    errorMessage: '[data-testid="error-message"]',
    loadingSpinner: '[data-testid="loading-spinner"]'
  }

  /**
   * Navigate to sales page
   */
  async goto(): Promise<void> {
    await this.page.goto('/sales')
    await this.page.waitForLoadState('networkidle')
    await delay(1000)
  }

  /**
   * Navigate to quick sale
   */
  async gotoQuickSale(): Promise<void> {
    await this.page.goto('/sales/simple')
    await this.page.waitForLoadState('networkidle')
    await delay(1000)
  }

  /**
   * Search for product
   */
  async searchProduct(query: string): Promise<void> {
    await this.page.waitForSelector(this.selectors.productSearch, { state: 'visible' })
    await delay(1000)
    await this.page.fill(this.selectors.productSearch, query)
    await delay(1000)
    await this.page.press(this.selectors.productSearch, 'Enter')
    await delay(1000)
  }

  /**
   * Select product by name
   */
  async selectProduct(productName: string): Promise<void> {
    const productSelector = `${this.selectors.productCard}:has-text("${productName}")`
    await this.page.waitForSelector(productSelector, { state: 'visible' })
    await delay(1000)
    await this.page.click(productSelector)
    await delay(1000)
  }

  /**
   * Set quantity
   */
  async setQuantity(quantity: number): Promise<void> {
    await this.page.waitForSelector(this.selectors.quantityInput, { state: 'visible' })
    await delay(1000)
    await this.page.fill(this.selectors.quantityInput, quantity.toString())
    await delay(1000)
  }

  /**
   * Add to cart
   */
  async addToCart(): Promise<void> {
    await this.page.waitForSelector(this.selectors.addToCartButton, { state: 'visible' })
    await delay(1000)
    await this.page.click(this.selectors.addToCartButton)
    await delay(1000)
  }

  /**
   * Add product to cart (complete flow)
   */
  async addProductToCart(productName: string, quantity: number): Promise<void> {
    await this.selectProduct(productName)
    await this.setQuantity(quantity)
    await this.addToCart()
    
    // Wait for cart update
    await this.page.waitForSelector(this.selectors.cartItem, { state: 'visible' })
    await delay(1000)
  }

  /**
   * Get cart total
   */
  async getCartTotal(): Promise<string> {
    await this.page.waitForSelector(this.selectors.cartTotal, { state: 'visible' })
    const element = await this.page.$(this.selectors.cartTotal)
    return await element!.textContent() || '0'
  }

  /**
   * Get cart items count
   */
  async getCartItemsCount(): Promise<number> {
    const items = await this.page.$$(this.selectors.cartItem)
    return items.length
  }

  /**
   * Remove item from cart
   */
  async removeFromCart(productName: string): Promise<void> {
    const removeSelector = `${this.selectors.cartItem}:has-text("${productName}") ${this.selectors.removeFromCart}`
    await this.page.waitForSelector(removeSelector, { state: 'visible' })
    await delay(1000)
    await this.page.click(removeSelector)
    await delay(1000)
  }

  /**
   * Clear cart
   */
  async clearCart(): Promise<void> {
    await this.page.waitForSelector(this.selectors.clearCartButton, { state: 'visible' })
    await delay(1000)
    await this.page.click(this.selectors.clearCartButton)
    await delay(1000)
  }

  /**
   * Proceed to checkout
   */
  async proceedToCheckout(): Promise<void> {
    await this.page.waitForSelector(this.selectors.checkoutButton, { state: 'visible' })
    await delay(1000)
    await this.page.click(this.selectors.checkoutButton)
    await delay(1000)
  }

  /**
   * Select payment method
   */
  async selectPaymentMethod(method: 'cash' | 'card' | 'transfer' | 'mobile'): Promise<void> {
    await this.page.waitForSelector(this.selectors.paymentMethodSelect, { state: 'visible' })
    await delay(1000)
    await this.page.selectOption(this.selectors.paymentMethodSelect, method)
    await delay(1000)
  }

  /**
   * Enter customer phone
   */
  async enterCustomerPhone(phone: string): Promise<void> {
    await this.page.waitForSelector(this.selectors.customerPhoneInput, { state: 'visible' })
    await delay(1000)
    await this.page.fill(this.selectors.customerPhoneInput, phone)
    await delay(1000)
  }

  /**
   * Enter notes
   */
  async enterNotes(notes: string): Promise<void> {
    await this.page.waitForSelector(this.selectors.notesInput, { state: 'visible' })
    await delay(1000)
    await this.page.fill(this.selectors.notesInput, notes)
    await delay(1000)
  }

  /**
   * Complete payment
   */
  async completePayment(): Promise<void> {
    await this.page.waitForSelector(this.selectors.completePaymentButton, { state: 'visible' })
    await delay(1000)
    await this.page.click(this.selectors.completePaymentButton)
    await delay(1000)
    
    // Wait for receipt modal
    await this.page.waitForSelector(this.selectors.receiptModal, { 
      state: 'visible',
      timeout: 10000 
    })
    await delay(1000)
  }

  /**
   * Complete sale (full flow)
   */
  async completeSale(
    products: Array<{ name: string; quantity: number }>,
    paymentMethod: 'cash' | 'card' | 'transfer' | 'mobile',
    customerPhone?: string
  ): Promise<string> {
    // Add products to cart
    for (const product of products) {
      await this.addProductToCart(product.name, product.quantity)
    }
    
    // Proceed to checkout
    await this.proceedToCheckout()
    
    // Select payment method
    await this.selectPaymentMethod(paymentMethod)
    
    // Enter customer phone if provided
    if (customerPhone) {
      await this.enterCustomerPhone(customerPhone)
    }
    
    // Complete payment
    await this.completePayment()
    
    // Get receipt number
    return await this.getReceiptNumber()
  }

  /**
   * Get receipt number
   */
  async getReceiptNumber(): Promise<string> {
    await this.page.waitForSelector(this.selectors.receiptNumber, { state: 'visible' })
    const element = await this.page.$(this.selectors.receiptNumber)
    return await element!.textContent() || ''
  }

  /**
   * Print receipt
   */
  async printReceipt(): Promise<void> {
    await this.page.waitForSelector(this.selectors.printReceiptButton, { state: 'visible' })
    await delay(1000)
    await this.page.click(this.selectors.printReceiptButton)
    await delay(1000)
  }

  /**
   * Close receipt modal
   */
  async closeReceipt(): Promise<void> {
    await this.page.waitForSelector(this.selectors.closeReceiptButton, { state: 'visible' })
    await delay(1000)
    await this.page.click(this.selectors.closeReceiptButton)
    await delay(1000)
  }

  /**
   * Get success message
   */
  async getSuccessMessage(): Promise<string | null> {
    try {
      const element = await this.page.waitForSelector(this.selectors.successMessage, { 
        timeout: 5000 
      })
      return await element.textContent()
    } catch {
      return null
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
}