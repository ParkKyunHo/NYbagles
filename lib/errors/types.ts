/**
 * 에러 코드 및 타입 정의
 * 
 * 에러 코드 형식: [DOMAIN]_[NUMBER]
 * - AUTH: 인증/인가 관련
 * - VAL: 유효성 검증
 * - DB: 데이터베이스
 * - QR: QR 코드 관련
 * - API: API 일반
 * - SYS: 시스템
 */

export enum ErrorCode {
  // Authentication & Authorization
  AUTH_001 = 'AUTH_001', // 인증 실패
  AUTH_002 = 'AUTH_002', // 세션 만료
  AUTH_003 = 'AUTH_003', // 권한 부족
  AUTH_004 = 'AUTH_004', // 승인 대기 중
  AUTH_005 = 'AUTH_005', // 계정 비활성화
  
  // Validation
  VAL_001 = 'VAL_001', // 필수 필드 누락
  VAL_002 = 'VAL_002', // 잘못된 형식
  VAL_003 = 'VAL_003', // 범위 초과
  VAL_004 = 'VAL_004', // 중복 데이터
  
  // Database
  DB_001 = 'DB_001', // 연결 실패
  DB_002 = 'DB_002', // 쿼리 실패
  DB_003 = 'DB_003', // 데이터 없음
  DB_004 = 'DB_004', // 트랜잭션 실패
  
  // QR Code
  QR_001 = 'QR_001', // QR 코드 만료
  QR_002 = 'QR_002', // 잘못된 QR 코드
  QR_003 = 'QR_003', // 위치 검증 실패
  QR_004 = 'QR_004', // 중복 체크인
  
  // API
  API_001 = 'API_001', // 잘못된 요청
  API_002 = 'API_002', // 리소스 없음
  API_003 = 'API_003', // 메서드 허용 안됨
  API_004 = 'API_004', // 요청 한도 초과
  
  // System
  SYS_001 = 'SYS_001', // 내부 서버 오류
  SYS_002 = 'SYS_002', // 서비스 이용 불가
  SYS_003 = 'SYS_003', // 설정 오류
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorDetails {
  code: ErrorCode
  message: string
  statusCode: number
  severity: ErrorSeverity
  details?: Record<string, any>
  stack?: string
  timestamp: string
  correlationId?: string
}

export interface ApiErrorResponse {
  success: false
  error: {
    code: ErrorCode
    message: string
    details?: Record<string, any>
    timestamp: string
    correlationId?: string
  }
}

export interface ApiSuccessResponse<T = any> {
  success: true
  data: T
  metadata?: {
    timestamp: string
    correlationId?: string
    [key: string]: any
  }
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse

// 에러 메시지 맵핑
export const ErrorMessages: Record<ErrorCode, string> = {
  // Authentication & Authorization
  [ErrorCode.AUTH_001]: '인증에 실패했습니다. 이메일과 비밀번호를 확인해주세요.',
  [ErrorCode.AUTH_002]: '세션이 만료되었습니다. 다시 로그인해주세요.',
  [ErrorCode.AUTH_003]: '이 작업을 수행할 권한이 없습니다.',
  [ErrorCode.AUTH_004]: '회원가입 승인 대기 중입니다. 관리자 승인 후 이용 가능합니다.',
  [ErrorCode.AUTH_005]: '계정이 비활성화되었습니다. 관리자에게 문의하세요.',
  
  // Validation
  [ErrorCode.VAL_001]: '필수 입력 항목을 확인해주세요.',
  [ErrorCode.VAL_002]: '입력 형식이 올바르지 않습니다.',
  [ErrorCode.VAL_003]: '입력값이 허용 범위를 초과했습니다.',
  [ErrorCode.VAL_004]: '이미 존재하는 데이터입니다.',
  
  // Database
  [ErrorCode.DB_001]: '데이터베이스 연결에 실패했습니다.',
  [ErrorCode.DB_002]: '데이터 처리 중 오류가 발생했습니다.',
  [ErrorCode.DB_003]: '요청한 데이터를 찾을 수 없습니다.',
  [ErrorCode.DB_004]: '데이터 트랜잭션 처리에 실패했습니다.',
  
  // QR Code
  [ErrorCode.QR_001]: 'QR 코드가 만료되었습니다. 새로고침 후 다시 시도하세요.',
  [ErrorCode.QR_002]: '유효하지 않은 QR 코드입니다.',
  [ErrorCode.QR_003]: '매장 위치가 확인되지 않습니다. 매장 내에서 시도해주세요.',
  [ErrorCode.QR_004]: '이미 체크인/체크아웃 처리되었습니다.',
  
  // API
  [ErrorCode.API_001]: '잘못된 요청입니다.',
  [ErrorCode.API_002]: '요청한 리소스를 찾을 수 없습니다.',
  [ErrorCode.API_003]: '허용되지 않은 메서드입니다.',
  [ErrorCode.API_004]: '요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.',
  
  // System
  [ErrorCode.SYS_001]: '서버 오류가 발생했습니다. 잠시 후 다시 시도하세요.',
  [ErrorCode.SYS_002]: '서비스를 일시적으로 이용할 수 없습니다.',
  [ErrorCode.SYS_003]: '시스템 설정 오류가 발생했습니다.',
}

// HTTP 상태 코드 맵핑
export const ErrorStatusCodes: Record<ErrorCode, number> = {
  // 401 Unauthorized
  [ErrorCode.AUTH_001]: 401,
  [ErrorCode.AUTH_002]: 401,
  
  // 403 Forbidden
  [ErrorCode.AUTH_003]: 403,
  [ErrorCode.AUTH_004]: 403,
  [ErrorCode.AUTH_005]: 403,
  
  // 400 Bad Request
  [ErrorCode.VAL_001]: 400,
  [ErrorCode.VAL_002]: 400,
  [ErrorCode.VAL_003]: 400,
  [ErrorCode.VAL_004]: 409, // Conflict
  
  // 500 Internal Server Error
  [ErrorCode.DB_001]: 500,
  [ErrorCode.DB_002]: 500,
  [ErrorCode.DB_003]: 404, // Not Found
  [ErrorCode.DB_004]: 500,
  
  // QR specific
  [ErrorCode.QR_001]: 400,
  [ErrorCode.QR_002]: 400,
  [ErrorCode.QR_003]: 403,
  [ErrorCode.QR_004]: 409,
  
  // API
  [ErrorCode.API_001]: 400,
  [ErrorCode.API_002]: 404,
  [ErrorCode.API_003]: 405,
  [ErrorCode.API_004]: 429,
  
  // System
  [ErrorCode.SYS_001]: 500,
  [ErrorCode.SYS_002]: 503,
  [ErrorCode.SYS_003]: 500,
}

// 에러 심각도 맵핑
export const ErrorSeverities: Record<ErrorCode, ErrorSeverity> = {
  // Authentication & Authorization
  [ErrorCode.AUTH_001]: ErrorSeverity.LOW,
  [ErrorCode.AUTH_002]: ErrorSeverity.LOW,
  [ErrorCode.AUTH_003]: ErrorSeverity.MEDIUM,
  [ErrorCode.AUTH_004]: ErrorSeverity.LOW,
  [ErrorCode.AUTH_005]: ErrorSeverity.MEDIUM,
  
  // Validation
  [ErrorCode.VAL_001]: ErrorSeverity.LOW,
  [ErrorCode.VAL_002]: ErrorSeverity.LOW,
  [ErrorCode.VAL_003]: ErrorSeverity.LOW,
  [ErrorCode.VAL_004]: ErrorSeverity.LOW,
  
  // Database
  [ErrorCode.DB_001]: ErrorSeverity.CRITICAL,
  [ErrorCode.DB_002]: ErrorSeverity.HIGH,
  [ErrorCode.DB_003]: ErrorSeverity.LOW,
  [ErrorCode.DB_004]: ErrorSeverity.HIGH,
  
  // QR Code
  [ErrorCode.QR_001]: ErrorSeverity.LOW,
  [ErrorCode.QR_002]: ErrorSeverity.LOW,
  [ErrorCode.QR_003]: ErrorSeverity.MEDIUM,
  [ErrorCode.QR_004]: ErrorSeverity.LOW,
  
  // API
  [ErrorCode.API_001]: ErrorSeverity.LOW,
  [ErrorCode.API_002]: ErrorSeverity.LOW,
  [ErrorCode.API_003]: ErrorSeverity.LOW,
  [ErrorCode.API_004]: ErrorSeverity.MEDIUM,
  
  // System
  [ErrorCode.SYS_001]: ErrorSeverity.HIGH,
  [ErrorCode.SYS_002]: ErrorSeverity.CRITICAL,
  [ErrorCode.SYS_003]: ErrorSeverity.HIGH,
}