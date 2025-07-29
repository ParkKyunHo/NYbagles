-- Complete Manual Setup for Admin User
-- Execute each step carefully in Supabase SQL Editor

-- ============================================
-- STEP 1: Remove problematic trigger
-- ============================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- Verify removal
SELECT COUNT(*) as trigger_count 
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- ============================================
-- STEP 2: Create user in Supabase Dashboard
-- ============================================
-- Go to Authentication > Users
-- Click "Create user" button
-- Enter:
--   Email: admin@nylovebagel.com
--   Password: Admin123!@#
--   Auto Confirm User: ✅ (CHECK THIS!)
-- Click "Create user"

-- ============================================
-- STEP 3: After user creation, create profile
-- ============================================
-- First, check if the user was created
SELECT id, email, created_at 
FROM auth.users 
WHERE email = 'admin@nylovebagel.com';

-- If user exists, create the profile
INSERT INTO profiles (id, email, full_name, role, phone, employee_code)
SELECT 
    id,
    email,
    '시스템 관리자' as full_name,
    'super_admin' as role,
    '010-0000-0000' as phone,
    'ADMIN001' as employee_code
FROM auth.users
WHERE email = 'admin@nylovebagel.com'
ON CONFLICT (id) DO UPDATE SET
    role = 'super_admin',
    full_name = '시스템 관리자',
    phone = '010-0000-0000',
    employee_code = 'ADMIN001';

-- Verify the profile was created correctly
SELECT * FROM profiles WHERE email = 'admin@nylovebagel.com';

-- ============================================
-- STEP 4: Create improved trigger for future users
-- ============================================
-- This is optional but recommended for future user registrations

-- Create improved handle_new_user function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Try to insert profile
    INSERT INTO profiles (
        id, 
        email, 
        full_name, 
        role,
        employee_code
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'employee'),
        UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 8))
    )
    ON CONFLICT (id) DO NOTHING;
    
    RETURN NEW;
EXCEPTION
    WHEN others THEN
        -- Log error but don't fail the user creation
        RAISE LOG 'Error in handle_new_user for %: %', NEW.email, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- STEP 5: Final verification
-- ============================================
-- Check all profiles
SELECT id, email, full_name, role, created_at 
FROM profiles 
ORDER BY created_at DESC;

-- Check if admin can be found
SELECT 
    u.id,
    u.email,
    u.created_at as user_created,
    p.full_name,
    p.role,
    p.created_at as profile_created
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE u.email = 'admin@nylovebagel.com';