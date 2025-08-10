/**
 * Transaction Helpers
 * 트랜잭션 관련 유틸리티 함수들
 */

import { SagaTransaction, TransactionStep, TransactionResult } from './transaction-manager'
import { createAdminClient } from '@/lib/supabase/server-admin'
import { logger } from '@/lib/logging/logger'

/**
 * Database transaction wrapper
 * Supabase 트랜잭션을 위한 래퍼
 */
export async function withDatabaseTransaction<T>(
  operation: (client: any) => Promise<T>
): Promise<T> {
  const client = createAdminClient()
  
  try {
    // Supabase doesn't have built-in transactions, 
    // but we can simulate with careful error handling
    const result = await operation(client)
    return result
  } catch (error) {
    logger.error('Database transaction failed', { error: error as Error })
    throw error
  }
}

/**
 * Create a product with inventory transaction
 */
export function createProductTransaction(
  productData: any,
  inventoryData: any
): SagaTransaction {
  const transaction = new SagaTransaction({
    timeout: 10000,
    maxRetries: 3
  })

  let createdProductId: string | null = null

  transaction
    .addStep({
      name: 'create-product',
      execute: async () => {
        const client = createAdminClient()
        const { data, error } = await client
          .from('products')
          .insert(productData)
          .select()
          .single()

        if (error) throw error
        createdProductId = data.id
        return data
      },
      compensate: async () => {
        if (createdProductId) {
          const client = createAdminClient()
          await client
            .from('products')
            .delete()
            .eq('id', createdProductId)
        }
      }
    })
    .addStep({
      name: 'create-inventory',
      execute: async () => {
        const client = createAdminClient()
        const { data, error } = await client
          .from('inventory_movements')
          .insert({
            ...inventoryData,
            product_id: createdProductId
          })
          .select()
          .single()

        if (error) throw error
        return data
      },
      compensate: async () => {
        if (createdProductId) {
          const client = createAdminClient()
          await client
            .from('inventory_movements')
            .delete()
            .eq('product_id', createdProductId)
        }
      }
    })

  return transaction
}

/**
 * Create a sale transaction with inventory update
 */
export function createSaleTransaction(
  saleData: any,
  items: Array<{ productId: string; quantity: number; price: number }>
): SagaTransaction {
  const transaction = new SagaTransaction({
    timeout: 15000,
    maxRetries: 2
  })

  let createdSaleId: string | null = null
  const originalStock: Map<string, number> = new Map()

  transaction
    .addStep({
      name: 'verify-stock',
      execute: async () => {
        const client = createAdminClient()
        
        // Check stock availability for all items
        for (const item of items) {
          const { data: product, error } = await client
            .from('products')
            .select('id, stock_quantity')
            .eq('id', item.productId)
            .single()

          if (error || !product) {
            throw new Error(`Product ${item.productId} not found`)
          }

          if (product.stock_quantity < item.quantity) {
            throw new Error(`Insufficient stock for product ${item.productId}`)
          }

          originalStock.set(item.productId, product.stock_quantity)
        }

        return true
      }
    })
    .addStep({
      name: 'create-sale',
      execute: async () => {
        const client = createAdminClient()
        const { data, error } = await client
          .from('sales_transactions')
          .insert(saleData)
          .select()
          .single()

        if (error) throw error
        createdSaleId = data.id
        return data
      },
      compensate: async () => {
        if (createdSaleId) {
          const client = createAdminClient()
          await client
            .from('sales_transactions')
            .delete()
            .eq('id', createdSaleId)
        }
      }
    })
    .addStep({
      name: 'create-sale-items',
      execute: async () => {
        const client = createAdminClient()
        const saleItems = items.map(item => ({
          sale_id: createdSaleId,
          product_id: item.productId,
          quantity: item.quantity,
          unit_price: item.price,
          subtotal: item.quantity * item.price
        }))

        const { data, error } = await client
          .from('sales_items')
          .insert(saleItems)
          .select()

        if (error) throw error
        return data
      },
      compensate: async () => {
        if (createdSaleId) {
          const client = createAdminClient()
          await client
            .from('sales_items')
            .delete()
            .eq('sale_id', createdSaleId)
        }
      }
    })
    .addStep({
      name: 'update-stock',
      execute: async () => {
        const client = createAdminClient()
        const updates = []

        for (const item of items) {
          const currentStock = originalStock.get(item.productId)!
          const newStock = currentStock - item.quantity

          const { error } = await client
            .from('products')
            .update({ stock_quantity: newStock })
            .eq('id', item.productId)

          if (error) throw error
          updates.push({ productId: item.productId, newStock })
        }

        return updates
      },
      compensate: async () => {
        const client = createAdminClient()
        
        // Restore original stock levels
        for (const [productId, stock] of originalStock) {
          await client
            .from('products')
            .update({ stock_quantity: stock })
            .eq('id', productId)
        }
      }
    })
    .addStep({
      name: 'create-inventory-movements',
      execute: async () => {
        const client = createAdminClient()
        const movements = items.map(item => ({
          product_id: item.productId,
          movement_type: 'sale',
          quantity: -item.quantity,
          reference_type: 'sale',
          reference_id: createdSaleId,
          created_by: saleData.created_by
        }))

        const { data, error } = await client
          .from('inventory_movements')
          .insert(movements)
          .select()

        if (error) throw error
        return data
      },
      compensate: async () => {
        if (createdSaleId) {
          const client = createAdminClient()
          await client
            .from('inventory_movements')
            .delete()
            .eq('reference_id', createdSaleId)
            .eq('reference_type', 'sale')
        }
      }
    })

  return transaction
}

/**
 * Create an employee with auth user and profile
 */
export function createEmployeeTransaction(
  employeeData: any,
  authData: { email: string; password: string }
): SagaTransaction {
  const transaction = new SagaTransaction({
    timeout: 20000,
    maxRetries: 2
  })

  let createdUserId: string | null = null
  let createdEmployeeId: string | null = null

  transaction
    .addStep({
      name: 'create-auth-user',
      execute: async () => {
        const client = createAdminClient()
        const { data, error } = await client.auth.admin.createUser({
          email: authData.email,
          password: authData.password,
          email_confirm: true
        })

        if (error || !data.user) throw error || new Error('Failed to create auth user')
        createdUserId = data.user.id
        return data.user
      },
      compensate: async () => {
        if (createdUserId) {
          const client = createAdminClient()
          await client.auth.admin.deleteUser(createdUserId)
        }
      },
      retryable: false // Auth operations should not be retried
    })
    .addStep({
      name: 'create-profile',
      execute: async () => {
        const client = createAdminClient()
        const { data, error } = await client
          .from('profiles')
          .insert({
            id: createdUserId,
            email: authData.email,
            name: employeeData.name,
            role: employeeData.role,
            store_id: employeeData.store_id
          })
          .select()
          .single()

        if (error) throw error
        return data
      },
      compensate: async () => {
        if (createdUserId) {
          const client = createAdminClient()
          await client
            .from('profiles')
            .delete()
            .eq('id', createdUserId)
        }
      }
    })
    .addStep({
      name: 'create-employee',
      execute: async () => {
        const client = createAdminClient()
        const { data, error } = await client
          .from('employees')
          .insert({
            ...employeeData,
            profile_id: createdUserId
          })
          .select()
          .single()

        if (error) throw error
        createdEmployeeId = data.id
        return data
      },
      compensate: async () => {
        if (createdEmployeeId) {
          const client = createAdminClient()
          await client
            .from('employees')
            .delete()
            .eq('id', createdEmployeeId)
        }
      }
    })

  return transaction
}

/**
 * Execute a transaction with logging
 */
export async function executeTransaction<T>(
  transactionId: string,
  transaction: SagaTransaction
): Promise<TransactionResult<T>> {
  logger.info(`Starting transaction: ${transactionId}`)

  // Add event listeners for monitoring
  transaction.on('stepStart', (stepName) => {
    logger.info(`Transaction ${transactionId} - Step started: ${stepName}`)
  })

  transaction.on('stepComplete', (stepName) => {
    logger.info(`Transaction ${transactionId} - Step completed: ${stepName}`)
  })

  transaction.on('stepFail', (stepName, error) => {
    logger.error(`Transaction ${transactionId} - Step failed: ${stepName}`, { error: error as Error })
  })

  transaction.on('compensateStart', (stepName) => {
    logger.info(`Transaction ${transactionId} - Compensating: ${stepName}`)
  })

  transaction.on('compensateComplete', (stepName) => {
    logger.info(`Transaction ${transactionId} - Compensated: ${stepName}`)
  })

  transaction.on('compensateFail', (stepName, error) => {
    logger.error(`Transaction ${transactionId} - Compensation failed: ${stepName}`, { error: error as Error })
  })

  try {
    const result = await transaction.execute<T>()

    if (result.success) {
      logger.info(`Transaction ${transactionId} completed successfully`)
    } else {
      logger.error(`Transaction ${transactionId} failed`, {
        error: result.error as Error,
        metadata: {
          failedStep: result.failedStep,
          compensated: result.compensated
        }
      })
    }

    return result
  } catch (error) {
    logger.error(`Transaction ${transactionId} encountered unexpected error`, { error: error as Error })
    return {
      success: false,
      error: error as Error
    }
  }
}

/**
 * Batch transaction executor
 * Execute multiple transactions in parallel with failure handling
 */
export async function executeBatchTransactions(
  transactions: Array<{
    id: string
    transaction: SagaTransaction
  }>
): Promise<Map<string, TransactionResult>> {
  const results = new Map<string, TransactionResult>()

  const promises = transactions.map(async ({ id, transaction }) => {
    const result = await executeTransaction(id, transaction)
    results.set(id, result)
    return { id, result }
  })

  await Promise.allSettled(promises)

  return results
}