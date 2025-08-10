/**
 * Transaction Module
 * 트랜잭션 관리 시스템 메인 진입점
 */

export {
  SagaTransaction,
  TransactionManager,
  transactionManager
} from './transaction-manager'

export type {
  TransactionState,
  TransactionStep,
  TransactionOptions,
  TransactionResult
} from './transaction-manager'

export {
  withDatabaseTransaction,
  createProductTransaction,
  createSaleTransaction,
  createEmployeeTransaction,
  executeTransaction,
  executeBatchTransactions
} from './transaction-helpers'

// Re-export for convenience
export { transactionManager as default } from './transaction-manager'