/**
 * Database Fixture
 * 테스트 데이터베이스 설정 및 정리
 */

import { createAdminClient } from '@/lib/supabase/server-admin'
import { SupabaseClient } from '@supabase/supabase-js'

export class DatabaseFixture {
  private supabase: SupabaseClient
  private testDataIds: {
    users: string[]
    products: string[]
    sales: string[]
    stores: string[]
  } = {
    users: [],
    products: [],
    sales: [],
    stores: []
  }

  constructor() {
    this.supabase = createAdminClient()
  }

  /**
   * Setup test database
   */
  async setup(): Promise<void> {
    console.log('Setting up test database...')
    
    // Create test store
    await this.createTestStore()
    
    // Create test users
    await this.createTestUsers()
    
    // Create test products
    await this.createTestProducts()
    
    console.log('Test database setup complete')
  }

  /**
   * Teardown test database
   */
  async teardown(): Promise<void> {
    console.log('Cleaning up test database...')
    
    // Delete test sales
    if (this.testDataIds.sales.length > 0) {
      await this.supabase
        .from('sales_transactions')
        .delete()
        .in('id', this.testDataIds.sales)
    }
    
    // Delete test products
    if (this.testDataIds.products.length > 0) {
      await this.supabase
        .from('products')
        .delete()
        .in('id', this.testDataIds.products)
    }
    
    // Delete test users
    for (const userId of this.testDataIds.users) {
      await this.supabase.auth.admin.deleteUser(userId)
    }
    
    // Delete test stores
    if (this.testDataIds.stores.length > 0) {
      await this.supabase
        .from('stores')
        .delete()
        .in('id', this.testDataIds.stores)
    }
    
    console.log('Test database cleanup complete')
  }

  /**
   * Create test store
   */
  private async createTestStore(): Promise<void> {
    const { data, error } = await this.supabase
      .from('stores')
      .insert({
        name: 'E2E Test Store',
        address: 'Test Address, Seoul',
        phone: '02-1234-5678',
        business_hours: '09:00-21:00',
        is_active: true
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create test store:', error)
      throw error
    }

    this.testDataIds.stores.push(data.id)
  }

  /**
   * Create test users
   */
  private async createTestUsers(): Promise<void> {
    const testUsers = [
      {
        email: 'e2e-admin@test.com',
        password: 'Test123456!',
        role: 'admin',
        name: 'E2E Admin'
      },
      {
        email: 'e2e-manager@test.com',
        password: 'Test123456!',
        role: 'manager',
        name: 'E2E Manager'
      },
      {
        email: 'e2e-employee@test.com',
        password: 'Test123456!',
        role: 'employee',
        name: 'E2E Employee'
      }
    ]

    for (const user of testUsers) {
      try {
        // Create auth user
        const { data: authData, error: authError } = await this.supabase.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
          user_metadata: {
            name: user.name,
            role: user.role
          }
        })

        if (authError) {
          console.error(`Failed to create user ${user.email}:`, authError)
          continue
        }

        if (authData?.user) {
          this.testDataIds.users.push(authData.user.id)

          // Create profile
          await this.supabase
            .from('profiles')
            .insert({
              id: authData.user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              store_id: this.testDataIds.stores[0]
            })

          // Create employee record
          await this.supabase
            .from('employees')
            .insert({
              id: authData.user.id,
              name: user.name,
              email: user.email,
              phone: '010-0000-0000',
              role: user.role,
              store_id: this.testDataIds.stores[0],
              employee_number: `E2E-${Date.now()}`,
              hire_date: new Date().toISOString(),
              is_active: true
            })
        }
      } catch (error) {
        console.error(`Error creating user ${user.email}:`, error)
      }
    }
  }

  /**
   * Create test products
   */
  private async createTestProducts(): Promise<void> {
    const testProducts = [
      {
        name: 'E2E Plain Bagel',
        sku: `E2E-BGL-001-${Date.now()}`,
        price: 3000,
        cost: 1500,
        stock_quantity: 100,
        category: 'bagel',
        store_id: this.testDataIds.stores[0],
        is_active: true
      },
      {
        name: 'E2E Everything Bagel',
        sku: `E2E-BGL-002-${Date.now()}`,
        price: 3500,
        cost: 1800,
        stock_quantity: 80,
        category: 'bagel',
        store_id: this.testDataIds.stores[0],
        is_active: true
      },
      {
        name: 'E2E Coffee',
        sku: `E2E-BEV-001-${Date.now()}`,
        price: 4000,
        cost: 1000,
        stock_quantity: 200,
        category: 'beverage',
        store_id: this.testDataIds.stores[0],
        is_active: true
      }
    ]

    const { data, error } = await this.supabase
      .from('products')
      .insert(testProducts)
      .select()

    if (error) {
      console.error('Failed to create test products:', error)
      throw error
    }

    if (data) {
      this.testDataIds.products = data.map(p => p.id)
    }
  }

  /**
   * Create test sale
   */
  async createTestSale(userId: string): Promise<string> {
    const { data, error } = await this.supabase
      .from('sales_transactions')
      .insert({
        store_id: this.testDataIds.stores[0],
        employee_id: userId,
        total_amount: 10500,
        tax_amount: 1050,
        payment_method: 'cash',
        status: 'completed'
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    this.testDataIds.sales.push(data.id)

    // Add sale items
    await this.supabase
      .from('sales_items')
      .insert([
        {
          transaction_id: data.id,
          product_id: this.testDataIds.products[0],
          quantity: 2,
          unit_price: 3000,
          subtotal: 6000
        },
        {
          transaction_id: data.id,
          product_id: this.testDataIds.products[2],
          quantity: 1,
          unit_price: 4000,
          subtotal: 4000
        }
      ])

    return data.id
  }

  /**
   * Get test store ID
   */
  getTestStoreId(): string {
    return this.testDataIds.stores[0]
  }

  /**
   * Get test product IDs
   */
  getTestProductIds(): string[] {
    return this.testDataIds.products
  }

  /**
   * Get test user IDs
   */
  getTestUserIds(): string[] {
    return this.testDataIds.users
  }

  /**
   * Reset specific table
   */
  async resetTable(tableName: string): Promise<void> {
    const allowedTables = ['sales_transactions', 'sales_items', 'inventory_movements']
    
    if (!allowedTables.includes(tableName)) {
      throw new Error(`Table ${tableName} is not allowed to be reset`)
    }

    // Only delete test data
    if (tableName === 'sales_transactions') {
      await this.supabase
        .from(tableName)
        .delete()
        .in('store_id', this.testDataIds.stores)
    }
  }
}