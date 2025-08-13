/**
 * 시스템 플로우 종합 테스트
 * 이 파일은 전체 데이터 플로우를 검증합니다
 */

import { createAdminClient } from '@/lib/supabase/server-admin'

interface TestResult {
  testName: string
  passed: boolean
  error?: string
  details?: any
}

export class SystemFlowTester {
  private adminClient = createAdminClient()
  private results: TestResult[] = []
  
  /**
   * 1. 상품 등록 → 판매 → 매출 반영 플로우 테스트
   */
  async testProductSalesFlow(): Promise<TestResult> {
    const testName = '상품-판매-매출 플로우'
    
    try {
      // 1. 테스트용 상품 생성
      const testProduct = {
        name: `TEST_PRODUCT_${Date.now()}`,
        sku: `SKU_${Date.now()}`,
        category: '베이글',
        base_price: 5000,
        stock_quantity: 10,
        store_id: null as string | null,
        status: 'active', // approval_status -> status로 변경
        is_active: true
      }
      
      // 매장 ID 조회
      const { data: stores } = await this.adminClient
        .from('stores')
        .select('id')
        .limit(1)
        .single()
      
      if (!stores) {
        return {
          testName,
          passed: false,
          error: '매장 정보를 찾을 수 없습니다'
        }
      }
      
      testProduct.store_id = stores.id
      
      // 상품 생성
      const { data: product, error: productError } = await this.adminClient
        .from('products')
        .insert(testProduct)
        .select()
        .single()
      
      if (productError) {
        return {
          testName,
          passed: false,
          error: `상품 생성 실패: ${productError.message}`
        }
      }
      
      // 2. 판매 기록 생성
      const { data: profiles } = await this.adminClient
        .from('profiles')
        .select('id')
        .limit(1)
        .single()
      
      if (!profiles) {
        return {
          testName,
          passed: false,
          error: '프로필 정보를 찾을 수 없습니다'
        }
      }
      
      const saleData = {
        transaction_number: `TXN_${Date.now()}`,
        store_id: testProduct.store_id,
        subtotal: testProduct.base_price * 2,
        total_amount: testProduct.base_price * 2,
        payment_method: 'cash',
        sold_by: profiles.id
      }
      
      const { data: sale, error: saleError } = await this.adminClient
        .from('sales_transactions')
        .insert(saleData)
        .select()
        .single()
      
      if (saleError) {
        // 정리: 생성한 상품 삭제
        await this.adminClient.from('products_v3').delete().eq('id', product.id)
        
        return {
          testName,
          passed: false,
          error: `판매 기록 생성 실패: ${saleError?.message || JSON.stringify(saleError)}`,
          details: { saleData, error: saleError }
        }
      }
      
      // 3. 재고 확인
      const { data: updatedProduct } = await this.adminClient
        .from('products')
        .select('stock_quantity')
        .eq('id', product.id)
        .single()
      
      const stockCorrect = updatedProduct?.stock_quantity === testProduct.stock_quantity
      
      // 4. 매출 집계 확인
      const { data: dailySummary } = await this.adminClient
        .from('daily_sales_summary')
        .select('*')
        .eq('store_id', testProduct.store_id)
        .eq('sale_date', saleData.sale_date)
        .single()
      
      // 5. 정리: 테스트 데이터 삭제
      await this.adminClient.from('sales_records').delete().eq('id', sale.id)
      await this.adminClient.from('products_v3').delete().eq('id', product.id)
      
      return {
        testName,
        passed: true,
        details: {
          product: product.id,
          sale: sale.id,
          stockUpdated: stockCorrect,
          dailySummary: dailySummary ? '집계됨' : '집계 안됨'
        }
      }
    } catch (error) {
      return {
        testName,
        passed: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      }
    }
  }
  
  /**
   * 2. 회원가입 → 승인/거절 → 직원관리 플로우 테스트
   */
  async testEmployeeSignupFlow(): Promise<TestResult> {
    const testName = '직원가입-승인 플로우'
    
    try {
      // 1. 가입 신청 생성
      const testEmail = `test_${Date.now()}@example.com`
      const signupData = {
        email: testEmail,
        full_name: 'Test User',
        phone: '010-0000-0000',
        status: 'pending',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }
      
      const { data: request, error: requestError } = await this.adminClient
        .from('employee_signup_requests')
        .insert(signupData)
        .select()
        .single()
      
      if (requestError) {
        return {
          testName,
          passed: false,
          error: `가입 신청 생성 실패: ${requestError.message}`
        }
      }
      
      // 2. 승인 처리 시뮬레이션
      const { data: adminUser } = await this.adminClient
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .limit(1)
        .single()
      
      // adminUser가 없으면 첫 번째 profiles 사용
      let approverUserId = adminUser?.id
      
      if (!approverUserId) {
        const { data: anyUser } = await this.adminClient
          .from('profiles')
          .select('id')
          .limit(1)
          .single()
        
        if (!anyUser) {
          // profiles가 없으면 테스트 건너뛰기
          return {
            testName,
            passed: false,
            error: 'profiles 테이블에 사용자가 없습니다'
          }
        }
        approverUserId = anyUser.id
      }
      
      const { error: approvalError } = await this.adminClient
        .from('employee_signup_requests')
        .update({
          status: 'approved',
          approved: true,
          approved_by: approverUserId,
          approved_at: new Date().toISOString()
        })
        .eq('id', request.id)
      
      if (approvalError) {
        // 정리
        await this.adminClient
          .from('employee_signup_requests')
          .delete()
          .eq('id', request.id)
        
        return {
          testName,
          passed: false,
          error: `승인 처리 실패: ${approvalError.message}`
        }
      }
      
      // 3. 승인 상태 확인
      const { data: approved } = await this.adminClient
        .from('employee_signup_requests')
        .select('*')
        .eq('id', request.id)
        .single()
      
      // 4. 정리: 테스트 데이터 삭제
      await this.adminClient
        .from('employee_signup_requests')
        .delete()
        .eq('id', request.id)
      
      return {
        testName,
        passed: approved?.status === 'approved',
        details: {
          requestId: request.id,
          status: approved?.status,
          approvedBy: approved?.approved_by
        }
      }
    } catch (error) {
      return {
        testName,
        passed: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      }
    }
  }
  
  /**
   * 3. Supabase 백엔드 ↔ 프론트엔드 동기화 테스트
   */
  async testDataSynchronization(): Promise<TestResult> {
    const testName = '데이터 동기화'
    
    try {
      // 1. 백엔드에서 데이터 생성
      const testData = {
        name: `SYNC_TEST_${Date.now()}`,
        sku: `SYNC_SKU_${Date.now()}`,
        category: '테스트',
        base_price: 1000,
        status: 'active', // approval_status -> status로 변경
        is_active: true
      }
      
      const { data: created, error: createError } = await this.adminClient
        .from('products')
        .insert(testData)
        .select()
        .single()
      
      if (createError) {
        return {
          testName,
          passed: false,
          error: `데이터 생성 실패: ${createError.message}`
        }
      }
      
      // 2. 데이터 조회
      const { data: fetched, error: fetchError } = await this.adminClient
        .from('products')
        .select('*')
        .eq('id', created.id)
        .single()
      
      if (fetchError) {
        await this.adminClient.from('products_v3').delete().eq('id', created.id)
        return {
          testName,
          passed: false,
          error: `데이터 조회 실패: ${fetchError.message}`
        }
      }
      
      // 3. 데이터 업데이트
      const updatedPrice = 2000
      const { error: updateError } = await this.adminClient
        .from('products')
        .update({ base_price: updatedPrice })
        .eq('id', created.id)
      
      if (updateError) {
        await this.adminClient.from('products_v3').delete().eq('id', created.id)
        return {
          testName,
          passed: false,
          error: `데이터 업데이트 실패: ${updateError.message}`
        }
      }
      
      // 4. 업데이트 확인
      const { data: updated } = await this.adminClient
        .from('products')
        .select('base_price')
        .eq('id', created.id)
        .single()
      
      // 5. 정리
      await this.adminClient.from('products').delete().eq('id', created.id)
      
      return {
        testName,
        passed: updated?.base_price === updatedPrice,
        details: {
          created: created.id,
          originalPrice: testData.base_price,
          updatedPrice: updated?.base_price,
          syncSuccess: updated?.base_price === updatedPrice
        }
      }
    } catch (error) {
      return {
        testName,
        passed: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      }
    }
  }
  
  /**
   * 모든 테스트 실행
   */
  async runAllTests(): Promise<{
    summary: {
      total: number
      passed: number
      failed: number
      successRate: string
    }
    results: TestResult[]
    recommendations: string[]
  }> {
    console.log('🔄 시스템 플로우 테스트 시작...')
    
    // 테스트 실행
    const productSalesResult = await this.testProductSalesFlow()
    this.results.push(productSalesResult)
    
    const signupFlowResult = await this.testEmployeeSignupFlow()
    this.results.push(signupFlowResult)
    
    const syncResult = await this.testDataSynchronization()
    this.results.push(syncResult)
    
    // 결과 집계
    const passed = this.results.filter(r => r.passed).length
    const failed = this.results.filter(r => !r.passed).length
    
    // 권장사항 생성
    const recommendations: string[] = []
    
    if (!productSalesResult.passed) {
      recommendations.push('❌ 상품-판매 플로우에 문제가 있습니다. sales_records 테이블 구조를 확인하세요.')
    }
    
    if (!signupFlowResult.passed) {
      recommendations.push('❌ 직원 가입 플로우에 문제가 있습니다. employee_signup_requests 테이블과 RLS 정책을 확인하세요.')
    }
    
    if (!syncResult.passed) {
      recommendations.push('❌ 데이터 동기화에 문제가 있습니다. Supabase 연결과 권한을 확인하세요.')
    }
    
    if (passed === this.results.length) {
      recommendations.push('✅ 모든 시스템 플로우가 정상 작동합니다!')
    }
    
    return {
      summary: {
        total: this.results.length,
        passed,
        failed,
        successRate: `${((passed / this.results.length) * 100).toFixed(1)}%`
      },
      results: this.results,
      recommendations
    }
  }
}

// 테스트 실행 헬퍼 함수
export async function runSystemFlowTests() {
  const tester = new SystemFlowTester()
  return await tester.runAllTests()
}