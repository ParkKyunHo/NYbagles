/**
 * 직렬화 헬퍼 유틸리티
 * 서버 컴포넌트에서 클라이언트 컴포넌트로 안전하게 데이터 전달
 */

/**
 * 객체를 JSON 직렬화 가능한 형태로 변환
 * - BigInt → string
 * - Date → ISO string
 * - undefined → null
 * - 함수, Symbol 등 제거
 */
export function toSerializable<T>(data: T): T {
  if (data === null || data === undefined) {
    return data
  }

  if (data instanceof Date) {
    return data.toISOString() as any
  }

  if (typeof data === 'bigint') {
    return data.toString() as any
  }

  if (Array.isArray(data)) {
    return data.map(item => toSerializable(item)) as any
  }

  if (typeof data === 'object') {
    const serialized: any = {}
    for (const [key, value] of Object.entries(data)) {
      // 함수, Symbol, undefined 제외
      if (typeof value === 'function' || typeof value === 'symbol') {
        continue
      }
      if (value === undefined) {
        serialized[key] = null
      } else {
        serialized[key] = toSerializable(value)
      }
    }
    return serialized
  }

  return data
}

/**
 * 데이터베이스 행을 직렬화 가능한 형태로 변환
 * 일반적인 DB 컬럼 타입 처리
 */
export function serializeRows<T extends Record<string, any>>(rows: T[]): T[] {
  return rows.map(row => ({
    ...row,
    // ID 필드 (BigInt 가능성)
    id: row.id ? String(row.id) : row.id,
    
    // 날짜 필드들
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    deleted_at: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
    
    // 기타 날짜 필드
    date: row.date ? new Date(row.date).toISOString() : null,
    hire_date: row.hire_date ? new Date(row.hire_date).toISOString() : null,
    approved_at: row.approved_at ? new Date(row.approved_at).toISOString() : null,
    decided_at: row.decided_at ? new Date(row.decided_at).toISOString() : null,
    
    // JSONB 필드 (이미 객체지만 안전하게 처리)
    bank_account: row.bank_account ? toSerializable(row.bank_account) : null,
    emergency_contact: row.emergency_contact ? toSerializable(row.emergency_contact) : null,
    operating_hours: row.operating_hours ? toSerializable(row.operating_hours) : null,
    config: row.config ? toSerializable(row.config) : null,
    details: row.details ? toSerializable(row.details) : null,
  }))
}

/**
 * 단일 객체 직렬화
 */
export function serializeObject<T extends Record<string, any>>(obj: T | null): T | null {
  if (!obj) return null
  return serializeRows([obj])[0]
}