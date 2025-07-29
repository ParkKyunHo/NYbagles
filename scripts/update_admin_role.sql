-- Update admin role to super_admin
UPDATE profiles 
SET role = 'super_admin', 
    full_name = '시스템 관리자',
    phone = '010-0000-0000'
WHERE email = 'admin@nylovebagel.com';

-- Verify the update
SELECT id, email, full_name, role, created_at 
FROM profiles 
WHERE email = 'admin@nylovebagel.com';

-- Show all profiles
SELECT id, email, full_name, role, created_at 
FROM profiles 
ORDER BY created_at DESC;