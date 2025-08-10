/**
 * Transaction Manager
 * 분산 트랜잭션 관리 및 Saga 패턴 구현
 */

import { EventEmitter } from 'events'
import { logger } from '@/lib/logging/logger'
import { Injectable } from '@/lib/core/decorators'
import { ServiceScope } from '@/lib/core/types'

export interface TransactionStep {
  name: string
  execute: () => Promise<any>
  compensate?: () => Promise<void>
  retryable?: boolean
  maxRetries?: number
}

export interface TransactionOptions {
  timeout?: number
  isolationLevel?: 'READ_UNCOMMITTED' | 'READ_COMMITTED' | 'REPEATABLE_READ' | 'SERIALIZABLE'
  maxRetries?: number
  retryDelay?: number
}

export interface TransactionResult<T = any> {
  success: boolean
  data?: T
  error?: Error
  failedStep?: string
  compensated?: boolean
}

export enum TransactionState {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMMITTING = 'COMMITTING',
  COMMITTED = 'COMMITTED',
  ROLLING_BACK = 'ROLLING_BACK',
  ROLLED_BACK = 'ROLLED_BACK',
  FAILED = 'FAILED'
}

/**
 * Saga Transaction
 * Implements the Saga pattern for distributed transactions
 */
export class SagaTransaction extends EventEmitter {
  private steps: TransactionStep[] = []
  private executedSteps: Array<{ step: TransactionStep; result: any }> = []
  private state: TransactionState = TransactionState.PENDING
  private options: Required<TransactionOptions>

  constructor(options: TransactionOptions = {}) {
    super()
    this.options = {
      timeout: options.timeout || 30000,
      isolationLevel: options.isolationLevel || 'READ_COMMITTED',
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000
    }
  }

  /**
   * Add a step to the transaction
   */
  addStep(step: TransactionStep): SagaTransaction {
    if (this.state !== TransactionState.PENDING) {
      throw new Error('Cannot add steps to a running or completed transaction')
    }

    this.steps.push(step)
    return this
  }

  /**
   * Execute the transaction
   */
  async execute<T = any>(): Promise<TransactionResult<T>> {
    if (this.state !== TransactionState.PENDING) {
      throw new Error('Transaction has already been executed')
    }

    this.state = TransactionState.RUNNING
    this.emit('start')

    const timeoutPromise = new Promise<TransactionResult<T>>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Transaction timeout after ${this.options.timeout}ms`))
      }, this.options.timeout)
    })

    try {
      const result = await Promise.race([
        this.executeSteps<T>(),
        timeoutPromise
      ])

      if (result.success) {
        this.state = TransactionState.COMMITTED
        this.emit('commit', result.data)
      } else {
        this.state = TransactionState.FAILED
        this.emit('fail', result.error)
      }

      return result
    } catch (error) {
      this.state = TransactionState.FAILED
      this.emit('fail', error)
      
      return {
        success: false,
        error: error as Error
      }
    }
  }

  /**
   * Execute all steps in sequence
   */
  private async executeSteps<T>(): Promise<TransactionResult<T>> {
    let lastResult: any

    for (const step of this.steps) {
      try {
        logger.info(`Executing transaction step: ${step.name}`)
        this.emit('stepStart', step.name)

        const result = await this.executeWithRetry(step)
        
        this.executedSteps.push({ step, result })
        lastResult = result
        
        logger.info(`Transaction step completed: ${step.name}`)
        this.emit('stepComplete', step.name, result)
      } catch (error) {
        logger.error(`Transaction step failed: ${step.name}`, { error: error as Error })
        this.emit('stepFail', step.name, error)

        // Start compensation
        const compensated = await this.compensate()
        
        return {
          success: false,
          error: error as Error,
          failedStep: step.name,
          compensated
        }
      }
    }

    this.state = TransactionState.COMMITTING
    
    return {
      success: true,
      data: lastResult as T
    }
  }

  /**
   * Execute a step with retry logic
   */
  private async executeWithRetry(step: TransactionStep): Promise<any> {
    const maxRetries = step.maxRetries ?? this.options.maxRetries
    const retryable = step.retryable ?? true
    
    let lastError: Error | undefined
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await step.execute()
      } catch (error) {
        lastError = error as Error
        
        if (!retryable || attempt === maxRetries) {
          throw error
        }
        
        logger.warn(`Retrying step ${step.name} (attempt ${attempt}/${maxRetries})`)
        await this.delay(this.options.retryDelay * attempt)
      }
    }
    
    throw lastError
  }

  /**
   * Compensate executed steps in reverse order
   */
  private async compensate(): Promise<boolean> {
    if (this.executedSteps.length === 0) {
      return true
    }

    this.state = TransactionState.ROLLING_BACK
    this.emit('rollbackStart')

    // Reverse the order for compensation
    const stepsToCompensate = [...this.executedSteps].reverse()
    let allCompensated = true

    for (const { step } of stepsToCompensate) {
      if (!step.compensate) {
        logger.warn(`No compensation defined for step: ${step.name}`)
        continue
      }

      try {
        logger.info(`Compensating step: ${step.name}`)
        this.emit('compensateStart', step.name)
        
        await step.compensate()
        
        logger.info(`Step compensated: ${step.name}`)
        this.emit('compensateComplete', step.name)
      } catch (error) {
        logger.error(`Failed to compensate step: ${step.name}`, { error: error as Error })
        this.emit('compensateFail', step.name, error)
        allCompensated = false
      }
    }

    this.state = allCompensated ? TransactionState.ROLLED_BACK : TransactionState.FAILED
    this.emit('rollbackComplete', allCompensated)
    
    return allCompensated
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get transaction state
   */
  getState(): TransactionState {
    return this.state
  }

  /**
   * Get executed steps
   */
  getExecutedSteps(): Array<{ step: TransactionStep; result: any }> {
    return [...this.executedSteps]
  }
}

/**
 * Transaction Manager Service
 * Manages and tracks all transactions
 */
@Injectable({ scope: ServiceScope.SINGLETON })
export class TransactionManager {
  private activeTransactions = new Map<string, SagaTransaction>()
  private transactionHistory: Array<{
    id: string
    state: TransactionState
    startTime: Date
    endTime?: Date
    error?: Error
  }> = []

  /**
   * Create a new transaction
   */
  createTransaction(id: string, options?: TransactionOptions): SagaTransaction {
    if (this.activeTransactions.has(id)) {
      throw new Error(`Transaction with ID ${id} already exists`)
    }

    const transaction = new SagaTransaction(options)
    
    // Track transaction lifecycle
    transaction.on('start', () => {
      this.transactionHistory.push({
        id,
        state: TransactionState.RUNNING,
        startTime: new Date()
      })
    })

    transaction.on('commit', () => {
      this.completeTransaction(id, TransactionState.COMMITTED)
    })

    transaction.on('fail', (error) => {
      this.completeTransaction(id, TransactionState.FAILED, error)
    })

    this.activeTransactions.set(id, transaction)
    
    return transaction
  }

  /**
   * Get an active transaction
   */
  getTransaction(id: string): SagaTransaction | undefined {
    return this.activeTransactions.get(id)
  }

  /**
   * Complete a transaction
   */
  private completeTransaction(
    id: string, 
    state: TransactionState, 
    error?: Error
  ): void {
    const transaction = this.activeTransactions.get(id)
    
    if (transaction) {
      this.activeTransactions.delete(id)
      
      // Update history
      const historyEntry = this.transactionHistory.find(h => h.id === id)
      if (historyEntry) {
        historyEntry.state = state
        historyEntry.endTime = new Date()
        historyEntry.error = error
      }
    }
  }

  /**
   * Get transaction history
   */
  getHistory(): typeof this.transactionHistory {
    return [...this.transactionHistory]
  }

  /**
   * Clear old transaction history
   */
  clearHistory(olderThan?: Date): void {
    if (!olderThan) {
      this.transactionHistory = []
      return
    }

    this.transactionHistory = this.transactionHistory.filter(
      entry => !entry.endTime || entry.endTime > olderThan
    )
  }

  /**
   * Get active transaction count
   */
  getActiveCount(): number {
    return this.activeTransactions.size
  }

  /**
   * Abort all active transactions
   */
  async abortAll(): Promise<void> {
    const promises: Promise<any>[] = []
    
    for (const [id, transaction] of this.activeTransactions) {
      logger.warn(`Aborting transaction: ${id}`)
      
      // Force compensate if possible
      if (transaction.getState() === TransactionState.RUNNING) {
        const executedSteps = transaction.getExecutedSteps()
        
        for (const { step } of [...executedSteps].reverse()) {
          if (step.compensate) {
            promises.push(
              step.compensate().catch(error => {
                logger.error(`Failed to compensate step ${step.name} during abort`, { error: error as Error })
              })
            )
          }
        }
      }
      
      this.completeTransaction(id, TransactionState.FAILED, new Error('Transaction aborted'))
    }
    
    await Promise.allSettled(promises)
  }
}

// Export singleton instance
export const transactionManager = new TransactionManager()