import { 
  ErrorCode, 
  ErrorDetails, 
  ErrorSeverity,
  ErrorMessages,
  ErrorStatusCodes,
  ErrorSeverities
} from './types'
import { logger } from '@/lib/logging/logger'

/**
 * 기본 에러 클래스
 * 모든 커스텀 에러의 베이스가 되는 클래스
 */
export class BaseError extends Error {
  public readonly code: ErrorCode
  public readonly statusCode: number
  public readonly severity: ErrorSeverity
  public readonly details?: Record<string, any>
  public readonly timestamp: string
  public readonly correlationId?: string
  public readonly isOperational: boolean

  constructor(
    code: ErrorCode,
    message?: string,
    details?: Record<string, any>,
    correlationId?: string
  ) {
    const errorMessage = message || ErrorMessages[code]
    super(errorMessage)

    this.code = code
    this.statusCode = ErrorStatusCodes[code]
    this.severity = ErrorSeverities[code]
    this.details = details
    this.timestamp = new Date().toISOString()
    this.correlationId = correlationId
    this.isOperational = true

    // 프로토타입 체인 유지
    Object.setPrototypeOf(this, BaseError.prototype)

    // 스택 트레이스 캡처
    Error.captureStackTrace(this, this.constructor)

    // 자동 로깅 (심각도에 따라)
    this.logError()
  }

  private logError(): void {
    const logContext = {
      code: this.code,
      statusCode: this.statusCode,
      severity: this.severity,
      details: this.details,
      correlationId: this.correlationId,
      stack: this.stack
    }

    switch (this.severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        logger.error(this.message, logContext)
        break
      case ErrorSeverity.MEDIUM:
        logger.warn(this.message, logContext)
        break
      case ErrorSeverity.LOW:
        logger.info(this.message, logContext)
        break
    }
  }

  toJSON(): ErrorDetails {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      severity: this.severity,
      details: this.details,
      timestamp: this.timestamp,
      correlationId: this.correlationId,
      // 프로덕션에서는 스택 트레이스 제외
      stack: process.env.NODE_ENV === 'development' ? this.stack : undefined
    }
  }
}

/**
 * 인증/인가 에러
 */
export class AuthError extends BaseError {
  constructor(
    code: ErrorCode = ErrorCode.AUTH_001,
    message?: string,
    details?: Record<string, any>,
    correlationId?: string
  ) {
    super(code, message, details, correlationId)
    Object.setPrototypeOf(this, AuthError.prototype)
  }

  static unauthorized(message?: string, details?: Record<string, any>): AuthError {
    return new AuthError(ErrorCode.AUTH_001, message, details)
  }

  static sessionExpired(details?: Record<string, any>): AuthError {
    return new AuthError(ErrorCode.AUTH_002, undefined, details)
  }

  static forbidden(message?: string, details?: Record<string, any>): AuthError {
    return new AuthError(ErrorCode.AUTH_003, message, details)
  }

  static pendingApproval(details?: Record<string, any>): AuthError {
    return new AuthError(ErrorCode.AUTH_004, undefined, details)
  }

  static accountDisabled(details?: Record<string, any>): AuthError {
    return new AuthError(ErrorCode.AUTH_005, undefined, details)
  }
}

/**
 * 유효성 검증 에러
 */
export class ValidationError extends BaseError {
  constructor(
    code: ErrorCode = ErrorCode.VAL_001,
    message?: string,
    details?: Record<string, any>,
    correlationId?: string
  ) {
    super(code, message, details, correlationId)
    Object.setPrototypeOf(this, ValidationError.prototype)
  }

  static missingField(field: string, details?: Record<string, any>): ValidationError {
    return new ValidationError(
      ErrorCode.VAL_001,
      `필수 필드가 누락되었습니다: ${field}`,
      { field, ...details }
    )
  }

  static invalidFormat(field: string, format: string, details?: Record<string, any>): ValidationError {
    return new ValidationError(
      ErrorCode.VAL_002,
      `${field} 필드의 형식이 올바르지 않습니다. ${format} 형식이어야 합니다.`,
      { field, format, ...details }
    )
  }

  static outOfRange(field: string, min?: number, max?: number, details?: Record<string, any>): ValidationError {
    return new ValidationError(
      ErrorCode.VAL_003,
      `${field} 값이 허용 범위를 벗어났습니다. (${min} ~ ${max})`,
      { field, min, max, ...details }
    )
  }

  static duplicate(field: string, value: any, details?: Record<string, any>): ValidationError {
    return new ValidationError(
      ErrorCode.VAL_004,
      `${field} 값이 이미 존재합니다: ${value}`,
      { field, value, ...details }
    )
  }
}

/**
 * 데이터베이스 에러
 */
export class DatabaseError extends BaseError {
  constructor(
    code: ErrorCode = ErrorCode.DB_001,
    message?: string,
    details?: Record<string, any>,
    correlationId?: string
  ) {
    super(code, message, details, correlationId)
    Object.setPrototypeOf(this, DatabaseError.prototype)
  }

  static connectionFailed(details?: Record<string, any>): DatabaseError {
    return new DatabaseError(ErrorCode.DB_001, undefined, details)
  }

  static queryFailed(query?: string, error?: any): DatabaseError {
    return new DatabaseError(
      ErrorCode.DB_002,
      undefined,
      { query, originalError: error?.message }
    )
  }

  static notFound(resource: string, id?: string | number): DatabaseError {
    return new DatabaseError(
      ErrorCode.DB_003,
      `${resource}을(를) 찾을 수 없습니다${id ? `: ${id}` : ''}`,
      { resource, id }
    )
  }

  static transactionFailed(details?: Record<string, any>): DatabaseError {
    return new DatabaseError(ErrorCode.DB_004, undefined, details)
  }
}

/**
 * QR 코드 관련 에러
 */
export class QRError extends BaseError {
  constructor(
    code: ErrorCode = ErrorCode.QR_001,
    message?: string,
    details?: Record<string, any>,
    correlationId?: string
  ) {
    super(code, message, details, correlationId)
    Object.setPrototypeOf(this, QRError.prototype)
  }

  static expired(details?: Record<string, any>): QRError {
    return new QRError(ErrorCode.QR_001, undefined, details)
  }

  static invalid(details?: Record<string, any>): QRError {
    return new QRError(ErrorCode.QR_002, undefined, details)
  }

  static locationMismatch(expectedLocation?: string, actualLocation?: string): QRError {
    return new QRError(
      ErrorCode.QR_003,
      undefined,
      { expectedLocation, actualLocation }
    )
  }

  static duplicateCheckIn(lastCheckIn?: string): QRError {
    return new QRError(
      ErrorCode.QR_004,
      undefined,
      { lastCheckIn }
    )
  }
}

/**
 * API 에러
 */
export class ApiError extends BaseError {
  constructor(
    code: ErrorCode = ErrorCode.API_001,
    message?: string,
    details?: Record<string, any>,
    correlationId?: string
  ) {
    super(code, message, details, correlationId)
    Object.setPrototypeOf(this, ApiError.prototype)
  }

  static badRequest(message?: string, details?: Record<string, any>): ApiError {
    return new ApiError(ErrorCode.API_001, message, details)
  }

  static notFound(resource?: string): ApiError {
    return new ApiError(
      ErrorCode.API_002,
      resource ? `${resource}을(를) 찾을 수 없습니다` : undefined
    )
  }

  static methodNotAllowed(method: string, allowed: string[]): ApiError {
    return new ApiError(
      ErrorCode.API_003,
      `${method} 메서드는 허용되지 않습니다. 허용된 메서드: ${allowed.join(', ')}`,
      { method, allowed }
    )
  }

  static rateLimitExceeded(retryAfter?: number): ApiError {
    return new ApiError(
      ErrorCode.API_004,
      undefined,
      { retryAfter }
    )
  }
}

/**
 * 시스템 에러
 */
export class SystemError extends BaseError {
  constructor(
    code: ErrorCode = ErrorCode.SYS_001,
    message?: string,
    details?: Record<string, any>,
    correlationId?: string
  ) {
    super(code, message, details, correlationId)
    Object.setPrototypeOf(this, SystemError.prototype)
  }

  static internal(error?: any): SystemError {
    return new SystemError(
      ErrorCode.SYS_001,
      undefined,
      { originalError: error?.message }
    )
  }

  static unavailable(service?: string): SystemError {
    return new SystemError(
      ErrorCode.SYS_002,
      service ? `${service} 서비스를 일시적으로 이용할 수 없습니다` : undefined,
      { service }
    )
  }

  static configurationError(config?: string): SystemError {
    return new SystemError(
      ErrorCode.SYS_003,
      config ? `설정 오류: ${config}` : undefined,
      { config }
    )
  }
}

/**
 * Supabase 에러를 커스텀 에러로 변환
 */
export function fromSupabaseError(error: any): BaseError {
  const message = error?.message || '알 수 없는 오류가 발생했습니다'
  const code = error?.code

  // Supabase Auth 에러 매핑
  if (code === 'invalid_credentials' || message.includes('Invalid login credentials')) {
    return AuthError.unauthorized()
  }
  
  if (code === 'session_not_found' || message.includes('Session not found')) {
    return AuthError.sessionExpired()
  }

  if (code === 'insufficient_access' || message.includes('insufficient')) {
    return AuthError.forbidden()
  }

  // Supabase Database 에러 매핑
  if (code === 'PGRST116' || message.includes('not found')) {
    return DatabaseError.notFound('리소스')
  }

  if (code === '23505' || message.includes('duplicate key')) {
    return ValidationError.duplicate('데이터', '')
  }

  if (code === '23503' || message.includes('foreign key')) {
    return ValidationError.invalidFormat('참조 키', '유효한 참조')
  }

  // 기본 시스템 에러
  return SystemError.internal(error)
}

/**
 * 에러인지 확인하는 타입 가드
 */
export function isOperationalError(error: any): error is BaseError {
  return error instanceof BaseError && error.isOperational
}