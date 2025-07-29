-- Fix handle_new_user trigger function
-- This script modifies the trigger to handle errors gracefully

-- Step 1: Remove existing trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Step 2: Redefine handle_new_user function with error handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if profile already exists
  IF EXISTS (SELECT 1 FROM profiles WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;
  
  -- Try to create profile
  BEGIN
    INSERT INTO profiles (id, email, full_name, role)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
      COALESCE(NEW.raw_user_meta_data->>'role', 'employee')
    );
  EXCEPTION
    WHEN others THEN
      -- Log error but don't fail the user creation
      RAISE NOTICE 'Error creating profile for user %: %', NEW.email, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Step 4: Verify the function exists
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'handle_new_user';

-- After running this script:
-- 1. Try creating user again in Supabase Dashboard
-- 2. If successful, update the role using update_admin_role.sql