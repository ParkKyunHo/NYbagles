-- Fix Auth Issue for Super Admin Creation
-- Execute this script in Supabase SQL Editor

-- Step 1: Temporarily disable the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Step 2: Update the CHECK constraint to include super_admin
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('super_admin', 'admin', 'manager', 'employee', 'part_time'));

-- Step 3: Verify the constraint was updated
SELECT conname, 
       contype,
       pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'profiles'::regclass 
AND conname = 'profiles_role_check';

-- Step 4: Re-enable the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Step 5: Show current profiles (if any)
SELECT id, email, full_name, role, created_at 
FROM profiles 
ORDER BY created_at DESC;

-- After running this script:
-- 1. Go to Authentication > Users in Supabase Dashboard
-- 2. Click "Create user" button
-- 3. Enter:
--    - Email: admin@nylovebagel.com
--    - Password: Admin123!@#
--    - Auto Confirm User: Check this box
-- 4. After user creation, run this UPDATE:
/*
UPDATE profiles 
SET role = 'super_admin', 
    full_name = '시스템 관리자'
WHERE email = 'admin@nylovebagel.com';
*/