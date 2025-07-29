import { NextResponse } from 'next/server'
import { ApiSuccessResponse, ApiErrorResponse } from '@/lib/errors/types'
import { BaseError } from '@/lib/errors/classes'
import { createErrorResponse } from '@/lib/errors/handler'

/**
 * 성공 응답 생성
 */
export function success<T = any>(
  data: T,
  metadata?: Record<string, any>,
  statusCode: number = 200
): NextResponse<ApiSuccessResponse<T>> {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
    metadata: {
      timestamp: new Date().toISOString(),
      ...metadata
    }
  }

  return NextResponse.json(response, { 
    status: statusCode,
    headers: metadata?.correlationId ? {
      'X-Correlation-Id': metadata.correlationId
    } : undefined
  })
}

/**
 * 에러 응답 생성 (BaseError 사용)
 */
export function error(error: BaseError): NextResponse<ApiErrorResponse> {
  return createErrorResponse(error)
}

/**
 * 201 Created 응답
 */
export function created<T = any>(
  data: T,
  metadata?: Record<string, any>
): NextResponse<ApiSuccessResponse<T>> {
  return success(data, metadata, 201)
}

/**
 * 204 No Content 응답
 */
export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 })
}

/**
 * 페이지네이션 응답
 */
export interface PaginatedData<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export function paginated<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
  metadata?: Record<string, any>
): NextResponse<ApiSuccessResponse<PaginatedData<T>>> {
  const totalPages = Math.ceil(total / pageSize)
  
  const data: PaginatedData<T> = {
    items,
    total,
    page,
    pageSize,
    totalPages
  }

  return success(data, {
    ...metadata,
    pagination: {
      hasNext: page < totalPages,
      hasPrev: page > 1,
      nextPage: page < totalPages ? page + 1 : null,
      prevPage: page > 1 ? page - 1 : null
    }
  })
}

/**
 * 리다이렉트 응답
 */
export function redirect(
  url: string,
  permanent: boolean = false
): NextResponse {
  return NextResponse.redirect(url, permanent ? 308 : 307)
}

/**
 * 캐시 헤더 설정
 */
export function withCache<T extends NextResponse>(
  response: T,
  options: {
    maxAge?: number      // 초 단위
    sMaxAge?: number     // CDN 캐시 시간
    staleWhileRevalidate?: number
    noStore?: boolean
    private?: boolean
  } = {}
): T {
  const {
    maxAge = 0,
    sMaxAge,
    staleWhileRevalidate,
    noStore = false,
    private: isPrivate = false
  } = options

  if (noStore) {
    response.headers.set('Cache-Control', 'no-store')
  } else {
    const directives = []
    
    if (isPrivate) {
      directives.push('private')
    } else {
      directives.push('public')
    }

    directives.push(`max-age=${maxAge}`)

    if (sMaxAge !== undefined) {
      directives.push(`s-maxage=${sMaxAge}`)
    }

    if (staleWhileRevalidate !== undefined) {
      directives.push(`stale-while-revalidate=${staleWhileRevalidate}`)
    }

    response.headers.set('Cache-Control', directives.join(', '))
  }

  return response
}

/**
 * CORS 헤더 설정 (추가 헤더용)
 */
export function withCors<T extends NextResponse>(
  response: T,
  origin?: string
): T {
  if (origin) {
    response.headers.set('Access-Control-Allow-Origin', origin)
  }
  
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  
  return response
}

/**
 * 응답 유틸리티 체인
 */
export class ResponseBuilder {
  private response: NextResponse
  
  constructor(response: NextResponse) {
    this.response = response
  }

  static success<T>(data: T, metadata?: Record<string, any>) {
    return new ResponseBuilder(success(data, metadata))
  }

  static error(error: BaseError) {
    return new ResponseBuilder(createErrorResponse(error))
  }

  cache(options: Parameters<typeof withCache>[1]) {
    this.response = withCache(this.response, options)
    return this
  }

  cors(origin?: string) {
    this.response = withCors(this.response, origin)
    return this
  }

  header(name: string, value: string) {
    this.response.headers.set(name, value)
    return this
  }

  build() {
    return this.response
  }
}

/**
 * 표준 API 응답 예제
 * 
 * // 성공 응답
 * return success({ user: { id: 1, name: 'John' } })
 * 
 * // 생성 응답
 * return created({ id: newId }, { location: `/api/items/${newId}` })
 * 
 * // 에러 응답
 * return error(ValidationError.missingField('email'))
 * 
 * // 페이지네이션 응답
 * return paginated(items, total, page, pageSize)
 * 
 * // 캐시와 함께
 * return ResponseBuilder
 *   .success(data)
 *   .cache({ maxAge: 3600, sMaxAge: 86400 })
 *   .build()
 */