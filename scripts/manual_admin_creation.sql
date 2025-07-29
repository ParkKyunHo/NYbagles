-- Manual Admin Creation (Alternative Method)
-- Use this if the trigger fix doesn't work

-- Step 1: Completely remove the problematic trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- Step 2: Create user in Supabase Dashboard first
-- Email: admin@nylovebagel.com
-- Password: Admin123!@#

-- Step 3: After user creation, run this to create profile
INSERT INTO profiles (id, email, full_name, role, phone)
SELECT 
  id,
  email,
  '시스템 관리자',
  'super_admin',
  '010-0000-0000'
FROM auth.users
WHERE email = 'admin@nylovebagel.com'
ON CONFLICT (id) DO UPDATE SET
  role = 'super_admin',
  full_name = '시스템 관리자';

-- Step 4: Verify the profile was created
SELECT id, email, full_name, role, created_at 
FROM profiles 
WHERE email = 'admin@nylovebagel.com';

-- Step 5: (Optional) Recreate a simpler trigger for future users
CREATE OR REPLACE FUNCTION handle_new_user_simple()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create profile if it doesn't exist
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'employee'  -- Always default to employee
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: Recreate trigger with simpler function
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION handle_new_user_simple();