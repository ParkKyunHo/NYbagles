-- 트리거 재생성 스크립트
-- Supabase SQL Editor에서 실행

-- 1. 기존 트리거 삭제
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. 새로운 트리거 함수 생성
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 프로필 생성
  INSERT INTO public.profiles (id, full_name, email, role, store_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'employee'),
    CASE 
      WHEN NEW.raw_user_meta_data->>'store_id' IS NULL THEN NULL
      ELSE (NEW.raw_user_meta_data->>'store_id')::uuid
    END
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', EXCLUDED.full_name),
    role = COALESCE(NEW.raw_user_meta_data->>'role', EXCLUDED.role),
    store_id = CASE 
      WHEN NEW.raw_user_meta_data->>'store_id' IS NULL THEN EXCLUDED.store_id
      ELSE (NEW.raw_user_meta_data->>'store_id')::uuid
    END;

  -- 직원 레코드 생성 (role이 employee인 경우만)
  IF COALESCE(NEW.raw_user_meta_data->>'role', 'employee') = 'employee' 
     AND NEW.raw_user_meta_data->>'store_id' IS NOT NULL THEN
    INSERT INTO public.employees (user_id, store_id, hourly_rate, is_active)
    VALUES (
      NEW.id,
      (NEW.raw_user_meta_data->>'store_id')::uuid,
      10500, -- 최저시급
      true
    )
    ON CONFLICT (user_id) DO UPDATE
    SET 
      store_id = (NEW.raw_user_meta_data->>'store_id')::uuid,
      is_active = true;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- 에러 발생 시 로그만 남기고 사용자 생성은 계속 진행
    RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- 3. 트리거 생성
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. 트리거 권한 설정
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role;