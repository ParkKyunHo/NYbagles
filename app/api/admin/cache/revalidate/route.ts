import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag, revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth/unified-auth'

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const user = await requireAuth()
    
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 캐시 태그 무효화
    revalidateTag('employees')
    revalidateTag('sales')
    revalidateTag('products')
    
    // 페이지 경로 무효화
    revalidatePath('/dashboard/employees')
    revalidatePath('/dashboard')
    revalidatePath('/', 'layout')
    
    return NextResponse.json({ 
      success: true,
      message: '캐시가 성공적으로 무효화되었습니다.'
    })
  } catch (error) {
    console.error('Cache revalidation error:', error)
    return NextResponse.json(
      { error: 'Failed to revalidate cache' },
      { status: 500 }
    )
  }
}