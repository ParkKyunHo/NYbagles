import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/errors/handler'
import { success, error, ResponseBuilder } from '@/lib/api/response'
import { 
  ValidationError, 
  AuthError, 
  DatabaseError,
  fromSupabaseError 
} from '@/lib/errors/classes'
import { createClient } from '@/lib/supabase/server'

/**
 * 에러 핸들링 시스템 사용 예제
 * 
 * withErrorHandler 래퍼를 사용하면 자동으로:
 * - 에러 로깅
 * - 표준화된 에러 응답
 * - Correlation ID 추가
 */

// GET 예제 - 데이터 조회
export const GET = withErrorHandler(async (req: NextRequest) => {
  // URL 파라미터 검증
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    throw ValidationError.missingField('id')
  }

  // Supabase 클라이언트 생성
  const supabase = await createClient()

  // 인증 확인
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    throw AuthError.unauthorized()
  }

  try {
    // 데이터 조회
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      throw fromSupabaseError(error)
    }

    if (!data) {
      throw DatabaseError.notFound('매장', id)
    }

    // 캐시와 함께 성공 응답
    return ResponseBuilder
      .success(data)
      .cache({ maxAge: 300, sMaxAge: 3600 })
      .build()

  } catch (error) {
    // fromSupabaseError가 처리하지 못한 에러는 다시 throw
    throw error
  }
})

// POST 예제 - 데이터 생성
export const POST = withErrorHandler(async (req: NextRequest) => {
  // 요청 본문 파싱
  let body
  try {
    body = await req.json()
  } catch {
    throw ValidationError.invalidFormat('body', 'JSON')
  }

  // 필드 검증
  const { name, code, categoryId } = body

  if (!name) {
    throw ValidationError.missingField('name')
  }

  if (!code || !/^[A-Z]{3,}[0-9]{3}$/.test(code)) {
    throw ValidationError.invalidFormat('code', 'XXX000 형식')
  }

  if (!categoryId) {
    throw ValidationError.missingField('categoryId')
  }

  const supabase = await createClient()

  // 권한 확인
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw AuthError.unauthorized()
  }

  // 중복 확인
  const { data: existing } = await supabase
    .from('stores')
    .select('id')
    .eq('code', code)
    .single()

  if (existing) {
    throw ValidationError.duplicate('code', code)
  }

  try {
    // 데이터 생성
    const { data, error } = await supabase
      .from('stores')
      .insert({
        name,
        code,
        category_id: categoryId,
        // ... 기타 필드
      })
      .select()
      .single()

    if (error) {
      throw fromSupabaseError(error)
    }

    // 201 Created 응답
    return success(data, { location: `/api/stores/${data.id}` }, 201)

  } catch (error) {
    throw error
  }
})

// 메서드 제한 예제
export async function PUT() {
  throw new Error('Method not allowed')
}

// DELETE 예제 - 권한 확인
export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    throw ValidationError.missingField('id')
  }

  const supabase = await createClient()

  // 사용자 권한 확인
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw AuthError.unauthorized()
  }

  // 프로필에서 역할 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    throw AuthError.forbidden('관리자 권한이 필요합니다')
  }

  try {
    const { error } = await supabase
      .from('stores')
      .delete()
      .eq('id', id)

    if (error) {
      throw fromSupabaseError(error)
    }

    // 204 No Content
    return new NextResponse(null, { status: 204 })

  } catch (error) {
    throw error
  }
})