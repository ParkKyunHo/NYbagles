-- Fix profile sync issues
-- This script ensures all auth users have corresponding profiles

-- Create missing profiles for auth users
INSERT INTO profiles (id, email, full_name, role, created_at, updated_at)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', 'Unknown User'),
    COALESCE(au.raw_user_meta_data->>'role', 'employee'),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
WHERE p.id IS NULL;

-- Log the results
DO $$
DECLARE
    created_count INTEGER;
BEGIN
    GET DIAGNOSTICS created_count = ROW_COUNT;
    IF created_count > 0 THEN
        RAISE NOTICE 'Created % missing profiles', created_count;
    ELSE
        RAISE NOTICE 'All auth users have profiles';
    END IF;
END $$;

-- Verify profile-employee relationship
SELECT 
    p.email,
    p.full_name,
    p.role as profile_role,
    e.role as employee_role,
    e.store_id,
    s.name as store_name
FROM profiles p
LEFT JOIN employees e ON p.id = e.user_id
LEFT JOIN stores s ON e.store_id = s.id
ORDER BY p.created_at DESC;