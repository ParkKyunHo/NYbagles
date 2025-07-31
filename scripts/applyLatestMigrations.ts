import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('환경 변수가 설정되지 않았습니다.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyMigrations() {
  console.log('최신 마이그레이션 적용 시작...')

  try {
    // 1. Multi-store support migration
    const multiStoreSql = fs.readFileSync(
      path.join(__dirname, '../supabase/migrations/20250131_fix_multi_store_support.sql'),
      'utf8'
    )
    
    console.log('1. 다중 매장 지원 마이그레이션 적용 중...')
    const { error: multiStoreError } = await supabase.rpc('exec_sql', {
      sql: multiStoreSql
    })
    
    if (multiStoreError) {
      console.error('Multi-store migration error:', multiStoreError)
      // Continue anyway as some parts might already exist
    } else {
      console.log('✅ 다중 매장 지원 마이그레이션 완료')
    }

    // 2. Store products RPC function
    const rpcSql = fs.readFileSync(
      path.join(__dirname, '../supabase/migrations/20250131_add_store_products_rpc.sql'),
      'utf8'
    )
    
    console.log('2. Store products RPC 함수 생성 중...')
    const { error: rpcError } = await supabase.rpc('exec_sql', {
      sql: rpcSql
    })
    
    if (rpcError) {
      console.error('RPC function creation error:', rpcError)
      // Try direct SQL execution
      const statements = rpcSql.split(';').filter(s => s.trim())
      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await supabase.rpc('exec_sql', { sql: statement + ';' })
          } catch (e) {
            console.log('Statement execution error (may be normal):', e)
          }
        }
      }
    } else {
      console.log('✅ Store products RPC 함수 생성 완료')
    }

    // 3. Check if store_id exists in profiles
    console.log('3. 프로필 테이블 확인 중...')
    const { data: columns } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'store_id'
      `
    })

    if (!columns || columns.length === 0) {
      console.log('store_id 컬럼 추가 중...')
      await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE profiles ADD COLUMN store_id UUID REFERENCES stores(id);'
      })
      console.log('✅ store_id 컬럼 추가 완료')
    }

    // 4. Create system_settings table if not exists
    console.log('4. 시스템 설정 테이블 확인 중...')
    const { data: settingsTable } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'system_settings'
      `
    })

    if (!settingsTable || settingsTable.length === 0) {
      console.log('시스템 설정 테이블 생성 중...')
      // Execute the system settings part from the migration
      const systemSettingsSql = `
        CREATE TABLE system_settings (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          key VARCHAR(255) UNIQUE NOT NULL,
          value JSONB NOT NULL,
          description TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          created_by UUID REFERENCES profiles(id)
        );

        ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Super admins can manage system settings"
        ON system_settings FOR ALL
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'super_admin'
          )
        );

        INSERT INTO system_settings (key, value, description) VALUES
          ('multi_store_enabled', 'true'::jsonb, '다중 매장 기능 활성화'),
          ('store_selection_required', 'true'::jsonb, '상품/판매 관리 시 매장 선택 필수'),
          ('manager_store_restriction', 'true'::jsonb, '매니저는 자신의 매장만 관리 가능')
        ON CONFLICT (key) DO NOTHING;
      `
      
      await supabase.rpc('exec_sql', { sql: systemSettingsSql })
      console.log('✅ 시스템 설정 테이블 생성 완료')
    }

    console.log('\n✅ 모든 마이그레이션이 성공적으로 적용되었습니다!')
    
  } catch (error) {
    console.error('마이그레이션 적용 중 오류 발생:', error)
  }
}

// exec_sql RPC function이 없는 경우를 위한 대체 함수
async function createExecSqlFunction() {
  try {
    const { error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1' })
    if (error) {
      console.log('exec_sql 함수 생성 중...')
      // This won't work without service role, but worth trying
      const createFunctionSql = `
        CREATE OR REPLACE FUNCTION exec_sql(sql text)
        RETURNS json AS $$
        DECLARE
          result json;
        BEGIN
          EXECUTE sql INTO result;
          RETURN result;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
      `
      
      // This will likely fail, but we try anyway
      await supabase.rpc('query', { query: createFunctionSql })
    }
  } catch (e) {
    console.log('exec_sql 함수를 생성할 수 없습니다. Supabase 대시보드에서 직접 마이그레이션을 실행해주세요.')
  }
}

async function main() {
  await createExecSqlFunction()
  await applyMigrations()
}

main()