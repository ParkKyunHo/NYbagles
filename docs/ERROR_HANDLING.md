# 에러 핸들링 시스템 가이드

베이글샵 통합 관리 시스템의 중앙집중식 에러 핸들링 시스템 사용 가이드입니다.

## 🏗️ 시스템 구조

### 계층 구조
```
├── 에러 타입 정의 (types.ts)
│   ├── ErrorCode enum
│   ├── ErrorSeverity enum
│   └── Response interfaces
├── 에러 클래스 (classes.ts)
│   ├── BaseError (기본)
│   ├── AuthError (인증/인가)
│   ├── ValidationError (유효성 검증)
│   ├── DatabaseError (데이터베이스)
│   ├── QRError (QR 코드)
│   ├── ApiError (API 일반)
│   └── SystemError (시스템)
├── 에러 핸들러 (handler.ts)
│   ├── withErrorHandler (API 래퍼)
│   ├── handleError (에러 처리)
│   └── withRetry (재시도 로직)
└── API 응답 표준화 (response.ts)
    ├── success/error 응답
    ├── ResponseBuilder
    └── 페이지네이션
```

## 📝 에러 코드 체계

### 코드 형식: `[DOMAIN]_[NUMBER]`

| 도메인 | 설명 | 예시 |
|--------|------|------|
| AUTH | 인증/인가 | AUTH_001: 인증 실패 |
| VAL | 유효성 검증 | VAL_001: 필수 필드 누락 |
| DB | 데이터베이스 | DB_001: 연결 실패 |
| QR | QR 코드 | QR_001: QR 코드 만료 |
| API | API 일반 | API_001: 잘못된 요청 |
| SYS | 시스템 | SYS_001: 내부 서버 오류 |

## 🔧 사용 방법

### 1. API Route에서 에러 처리

```typescript
import { withErrorHandler } from '@/lib/errors/handler'
import { ValidationError, AuthError } from '@/lib/errors/classes'
import { success, error } from '@/lib/api/response'

// withErrorHandler로 감싸면 자동 에러 처리
export const GET = withErrorHandler(async (req: NextRequest) => {
  // 검증 에러
  if (!id) {
    throw ValidationError.missingField('id')
  }

  // 인증 에러
  if (!user) {
    throw AuthError.unauthorized()
  }

  // 성공 응답
  return success({ data: result })
})
```

### 2. 에러 타입별 사용 예제

#### 인증/인가 에러
```typescript
// 로그인 실패
throw AuthError.unauthorized('이메일 또는 비밀번호가 일치하지 않습니다')

// 세션 만료
throw AuthError.sessionExpired()

// 권한 부족
throw AuthError.forbidden('관리자 권한이 필요합니다')

// 승인 대기
throw AuthError.pendingApproval({ userId: user.id })

// 계정 비활성화
throw AuthError.accountDisabled()
```

#### 유효성 검증 에러
```typescript
// 필수 필드 누락
throw ValidationError.missingField('email')

// 잘못된 형식
throw ValidationError.invalidFormat('phone', '010-0000-0000')

// 범위 초과
throw ValidationError.outOfRange('age', 18, 65)

// 중복 데이터
throw ValidationError.duplicate('email', 'user@example.com')
```

#### 데이터베이스 에러
```typescript
// 연결 실패
throw DatabaseError.connectionFailed()

// 쿼리 실패
throw DatabaseError.queryFailed('SELECT * FROM users', error)

// 데이터 없음
throw DatabaseError.notFound('사용자', userId)

// 트랜잭션 실패
throw DatabaseError.transactionFailed({ operation: 'create_order' })
```

#### QR 코드 에러
```typescript
// QR 만료
throw QRError.expired({ qrCode: token })

// 잘못된 QR
throw QRError.invalid()

// 위치 불일치
throw QRError.locationMismatch('강남역점', '삼성점')

// 중복 체크인
throw QRError.duplicateCheckIn('2024-01-25 09:00:00')
```

### 3. Supabase 에러 변환

```typescript
import { fromSupabaseError } from '@/lib/errors/classes'

try {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .single()

  if (error) {
    throw fromSupabaseError(error)
  }
} catch (error) {
  // 자동으로 적절한 커스텀 에러로 변환됨
  throw error
}
```

### 4. 클라이언트 에러 처리

#### Error Boundary 사용
```tsx
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default function Page() {
  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <div>
          <p>오류: {error.message}</p>
          <button onClick={reset}>다시 시도</button>
        </div>
      )}
    >
      <YourComponent />
    </ErrorBoundary>
  )
}
```

#### 비동기 에러 처리
```tsx
import { useErrorHandler } from '@/components/ErrorBoundary'

function MyComponent() {
  const { captureError } = useErrorHandler()

  const handleSubmit = async () => {
    try {
      await submitData()
    } catch (error) {
      captureError(error as Error)
    }
  }
}
```

### 5. 응답 표준화

#### 성공 응답
```typescript
// 기본 성공
return success({ user: userData })

// 201 Created
return created({ id: newId }, { location: `/api/items/${newId}` })

// 204 No Content
return noContent()

// 페이지네이션
return paginated(items, total, page, pageSize)
```

#### 캐시 설정
```typescript
return ResponseBuilder
  .success(data)
  .cache({ 
    maxAge: 300,      // 5분
    sMaxAge: 3600,    // CDN 1시간
    staleWhileRevalidate: 86400  // 24시간
  })
  .build()
```

### 6. 재시도 로직

```typescript
import { withRetry } from '@/lib/errors/handler'

// 자동 재시도 (최대 3번)
const result = await withRetry(
  async () => {
    return await fetchDataFromAPI()
  },
  {
    maxAttempts: 3,
    onRetry: (error, attempt) => {
      console.log(`재시도 ${attempt}번째...`)
    }
  }
)
```

## 🔍 디버깅

### 개발 환경
- 상세한 에러 스택 트레이스 표시
- 에러 details 필드 포함
- 콘솔에 전체 에러 정보 로깅

### 프로덕션 환경
- 사용자 친화적 메시지만 표시
- 민감한 정보 제거
- 에러 로깅은 서버에만 기록

### Correlation ID
모든 에러에는 추적을 위한 Correlation ID가 포함됩니다:
```
X-Correlation-Id: 1706237845123-abc123
```

## 📊 에러 모니터링

### 로그 레벨
- **CRITICAL/HIGH**: error 로그
- **MEDIUM**: warn 로그  
- **LOW**: info 로그

### 에러 심각도
```typescript
enum ErrorSeverity {
  LOW = 'low',        // 사용자 실수, 일반적인 검증 오류
  MEDIUM = 'medium',  // 권한 문제, Rate limit
  HIGH = 'high',      // 시스템 오류, DB 쿼리 실패
  CRITICAL = 'critical' // 서비스 중단, DB 연결 실패
}
```

## 🚨 주의사항

1. **에러 throw 시점**
   - 가능한 빨리 검증하고 에러 throw
   - try-catch는 필요한 곳에만 사용

2. **에러 메시지**
   - 사용자가 이해할 수 있는 메시지 사용
   - 기술적 세부사항은 details에 포함

3. **보안**
   - 프로덕션에서는 민감한 정보 노출 금지
   - 스택 트레이스는 개발 환경에서만

4. **성능**
   - 에러 생성은 비용이 크므로 남용 금지
   - 정상적인 흐름 제어에는 사용하지 않음

---

더 자세한 정보는 소스 코드의 주석을 참고하세요.