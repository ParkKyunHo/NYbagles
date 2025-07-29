import { NextRequest, NextResponse } from 'next/server'
import { BaseError, SystemError, isOperationalError } from './classes'
import { ApiErrorResponse, ErrorCode } from './types'
import { logger } from '@/lib/logging/logger'

/**
 * 에러 응답 생성
 */
export function createErrorResponse(error: BaseError): NextResponse<ApiErrorResponse> {
  const response: ApiErrorResponse = {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      timestamp: error.timestamp,
      correlationId: error.correlationId,
      // 개발 환경에서만 상세 정보 포함
      ...(process.env.NODE_ENV === 'development' && {
        details: error.details,
      })
    }
  }

  return NextResponse.json(response, { 
    status: error.statusCode,
    headers: {
      'X-Correlation-Id': error.correlationId || '',
    }
  })
}

/**
 * 에러 핸들러 - API Route에서 사용
 */
export async function handleError(
  error: unknown,
  request?: NextRequest
): Promise<NextResponse<ApiErrorResponse>> {
  // Correlation ID 생성
  const correlationId = request?.headers.get('x-correlation-id') || 
                        `${Date.now()}-${Math.random().toString(36).substring(7)}`

  let appError: BaseError

  if (isOperationalError(error)) {
    // 이미 우리가 정의한 에러인 경우
    appError = error as BaseError
  } else if (error instanceof Error) {
    // 일반 에러인 경우
    appError = SystemError.internal(error)
  } else {
    // 알 수 없는 에러
    appError = new SystemError(
      ErrorCode.SYS_001,
      '알 수 없는 오류가 발생했습니다',
      { originalError: String(error) },
      correlationId
    )
  }

  // 요청 컨텍스트 추가 (개발 환경)
  if (process.env.NODE_ENV === 'development' && request) {
    logger.debug('Request context', {
      method: request.method,
      path: request.url,
      metadata: {
        url: request.url,
        headers: Object.fromEntries(request.headers.entries()),
        correlationId
      }
    })
  }

  return createErrorResponse(appError)
}

/**
 * API Route 래퍼 - 에러 핸들링 자동화
 */
type ApiHandler = (req: NextRequest, context?: any) => Promise<NextResponse>

export function withErrorHandler(handler: ApiHandler): ApiHandler {
  return async (req: NextRequest, context?: any) => {
    try {
      // Correlation ID 설정
      const correlationId = req.headers.get('x-correlation-id') || 
                            `${Date.now()}-${Math.random().toString(36).substring(7)}`
      
      // 요청 로깅
      logger.info(`${req.method} ${req.url}`, {
        method: req.method,
        path: req.url,
        metadata: {
          url: req.url,
          correlationId
        }
      })

      // 핸들러 실행
      const response = await handler(req, context)

      // 응답에 Correlation ID 추가
      response.headers.set('X-Correlation-Id', correlationId)

      return response
    } catch (error) {
      return handleError(error, req)
    }
  }
}

/**
 * 에러 바운더리를 위한 클라이언트 에러 핸들러
 */
export function getClientErrorMessage(error: unknown): string {
  if (isOperationalError(error)) {
    return error.message
  }

  if (error instanceof Error) {
    return process.env.NODE_ENV === 'development' 
      ? error.message 
      : '오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
  }

  return '알 수 없는 오류가 발생했습니다.'
}

/**
 * 에러 재시도 가능 여부 확인
 */
export function isRetryableError(error: unknown): boolean {
  if (!isOperationalError(error)) {
    return false
  }

  const retryableCodes = [
    ErrorCode.DB_001,    // DB 연결 실패
    ErrorCode.DB_004,    // 트랜잭션 실패
    ErrorCode.API_004,   // Rate limit
    ErrorCode.SYS_002,   // 서비스 일시 이용 불가
  ]

  return retryableCodes.includes((error as BaseError).code)
}

/**
 * 에러 재시도 지연 시간 계산
 */
export function getRetryDelay(
  error: unknown, 
  attemptNumber: number
): number | null {
  if (!isRetryableError(error)) {
    return null
  }

  const baseDelay = 1000 // 1초
  const maxDelay = 30000 // 30초

  // 지수 백오프 with jitter
  const exponentialDelay = Math.min(
    baseDelay * Math.pow(2, attemptNumber - 1),
    maxDelay
  )

  // 0-25% 랜덤 jitter 추가
  const jitter = exponentialDelay * Math.random() * 0.25

  return Math.floor(exponentialDelay + jitter)
}

/**
 * 에러 복구 시도
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number
    onRetry?: (error: unknown, attempt: number) => void
  } = {}
): Promise<T> {
  const { maxAttempts = 3, onRetry } = options
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      if (!isRetryableError(error) || attempt === maxAttempts) {
        throw error
      }

      const delay = getRetryDelay(error, attempt)
      if (delay) {
        onRetry?.(error, attempt)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError
}