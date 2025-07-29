# QR 코드 로그인 시스템 설계 문서

## 개요
기존 베이글샵 통합 관리 시스템에 추가되는 QR 코드 기반 직원 로그인 시스템 설계

## 새로운 요구사항
1. **직원 회원가입 기능** - 직원이 직접 가입할 수 있는 기능
2. **매장별 고유 QR 코드** - 각 매장마다 고유한 QR 코드 생성
3. **계층적 조직 구조**
   - 최상위 관리자: 전체 시스템 관리
   - 지역 관리자: 해당 지역 매장들 관리  
   - 매장 관리자: 해당 매장 관리
   - 직원: 출퇴근 기록

## 데이터베이스 스키마 변경사항

### 1. 새로운 테이블 추가

```sql
-- 지역 테이블
CREATE TABLE regions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 매장 카테고리 테이블
CREATE TABLE store_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  region_id UUID REFERENCES regions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 매장 테이블
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES store_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  address TEXT,
  phone TEXT,
  qr_code_id TEXT UNIQUE NOT NULL,
  qr_secret TEXT NOT NULL, -- 암호화된 시크릿
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- QR 토큰 테이블 (보안 강화)
CREATE TABLE qr_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 seconds',
  is_used BOOLEAN DEFAULT false,
  used_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 직원 회원가입 요청 테이블
CREATE TABLE employee_signup_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  store_id UUID REFERENCES stores(id),
  verification_code TEXT,
  verified BOOLEAN DEFAULT false,
  approved BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. 기존 테이블 수정

```sql
-- profiles 테이블에 super_admin 역할 추가
ALTER TABLE profiles 
  DROP CONSTRAINT profiles_role_check,
  ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('super_admin', 'admin', 'manager', 'employee', 'part_time'));

-- employees 테이블에 store_id 추가
ALTER TABLE employees 
  ADD COLUMN store_id UUID REFERENCES stores(id);

-- attendance_records 테이블에 store_id와 qr_validation 추가
ALTER TABLE attendance_records
  ADD COLUMN store_id UUID REFERENCES stores(id),
  ADD COLUMN qr_validation_token TEXT,
  ADD COLUMN check_in_method TEXT DEFAULT 'qr' 
    CHECK (check_in_method IN ('qr', 'manual', 'admin'));
```

## QR 코드 시스템 설계

### 1. QR 코드 데이터 구조
```typescript
interface StoreQRData {
  store_id: string;
  timestamp: number;
  token: string; // TOTP 기반
  signature: string; // HMAC-SHA256
}
```

### 2. QR 코드 생성 프로세스
```typescript
// 매장 QR 코드 생성 (30초마다 갱신)
function generateStoreQRCode(storeId: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 30000) * 30000;
  const token = generateTOTP(secret, timestamp);
  
  const data = {
    store_id: storeId,
    timestamp,
    token,
    signature: createHmacSignature({ store_id: storeId, timestamp, token }, secret)
  };
  
  return encrypt(JSON.stringify(data));
}
```

### 3. 출퇴근 프로세스
1. 직원이 모바일 앱에서 매장의 QR 코드 스캔
2. QR 데이터 검증 (시간, 서명, 토큰)
3. 직원의 위치 확인 (옵션)
4. 출퇴근 기록 생성
5. 실시간 알림 전송

## 인증 및 권한 시스템

### 1. 역할별 권한
```typescript
const permissions = {
  super_admin: {
    regions: ['create', 'read', 'update', 'delete'],
    stores: ['create', 'read', 'update', 'delete'],
    employees: ['create', 'read', 'update', 'delete'],
    all_data: true
  },
  admin: { // 지역 관리자
    regions: ['read'],
    stores: ['create', 'read', 'update'], // 자신의 지역만
    employees: ['create', 'read', 'update'], // 자신의 지역 매장만
    own_region_data: true
  },
  manager: { // 매장 관리자
    stores: ['read'], // 자신의 매장만
    employees: ['read', 'update'], // 자신의 매장만
    attendance: ['create', 'read', 'update'],
    own_store_data: true
  },
  employee: {
    own_profile: ['read', 'update'],
    attendance: ['create'], // 자신의 출퇴근만
    own_data: true
  }
};
```

### 2. RLS 정책 추가
```sql
-- 지역별 접근 권한
CREATE POLICY "Super admins can manage all regions" ON regions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- 매장별 접근 권한
CREATE POLICY "Regional admins can manage own region stores" ON stores
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN store_categories sc ON sc.region_id IN (
        SELECT region_id FROM store_categories
        WHERE created_by = p.id
      )
      WHERE p.id = auth.uid() AND p.role = 'admin'
      AND stores.category_id = sc.id
    )
  );
```

## API 엔드포인트

### 1. 직원 회원가입
```
POST /api/auth/employee-signup
{
  "email": "string",
  "password": "string",
  "full_name": "string",
  "phone": "string",
  "store_code": "string" // 매장 코드로 매장 찾기
}
```

### 2. QR 로그인
```
POST /api/attendance/qr-checkin
{
  "qr_data": "encrypted_string",
  "location": {
    "lat": number,
    "lng": number
  }
}
```

### 3. 매장 QR 코드 조회
```
GET /api/stores/:id/qr-code
Response: {
  "qr_code": "base64_image",
  "expires_in": 30 // seconds
}
```

## 프론트엔드 컴포넌트

### 1. QR 스캐너 컴포넌트
```typescript
// components/qr/QRScanner.tsx
interface QRScannerProps {
  onScan: (data: string) => void;
  onError: (error: Error) => void;
}
```

### 2. 매장 QR 디스플레이
```typescript
// components/store/StoreQRDisplay.tsx
interface StoreQRDisplayProps {
  storeId: string;
  refreshInterval?: number; // default: 30s
}
```

### 3. 직원 가입 폼
```typescript
// components/auth/EmployeeSignupForm.tsx
interface EmployeeSignupFormProps {
  onSuccess: () => void;
}
```

## 보안 고려사항

1. **QR 코드 보안**
   - 30초마다 토큰 갱신
   - HMAC 서명으로 위변조 방지
   - AES-256 암호화

2. **위치 검증**
   - GPS 위치 확인 (선택적)
   - 매장 반경 100m 이내 체크

3. **중복 방지**
   - 동일 토큰 재사용 방지
   - 연속 체크인 방지 (최소 1분 간격)

4. **감사 로그**
   - 모든 출퇴근 기록 로깅
   - 관리자 활동 추적

## 구현 우선순위

1. **Phase 1 - 기본 구조** (1주)
   - 데이터베이스 스키마 업데이트
   - 지역/매장 관리 기능
   - 권한 시스템 구현

2. **Phase 2 - QR 시스템** (1주)
   - QR 코드 생성/검증
   - 출퇴근 API
   - 보안 메커니즘

3. **Phase 3 - UI/UX** (1주)
   - 직원 가입 플로우
   - QR 스캐너 UI
   - 관리자 대시보드

4. **Phase 4 - 고급 기능** (1주)
   - 위치 기반 검증
   - 실시간 알림
   - 분석 리포트