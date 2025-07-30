-- Fix store_id NULL issues in employees table
-- This script ensures all employees have a valid store_id

-- First, check for employees without store_id
DO $$
DECLARE
    unassigned_count INTEGER;
    default_store_id UUID;
BEGIN
    -- Count employees without store_id
    SELECT COUNT(*) INTO unassigned_count
    FROM employees
    WHERE store_id IS NULL;
    
    IF unassigned_count > 0 THEN
        RAISE NOTICE 'Found % employees without store_id', unassigned_count;
        
        -- Get the first active store as default
        SELECT id INTO default_store_id
        FROM stores
        WHERE is_active = true
        ORDER BY created_at
        LIMIT 1;
        
        IF default_store_id IS NOT NULL THEN
            -- Update all employees without store_id
            UPDATE employees
            SET store_id = default_store_id,
                updated_at = CURRENT_TIMESTAMP
            WHERE store_id IS NULL;
            
            RAISE NOTICE 'Updated % employees with default store_id: %', unassigned_count, default_store_id;
        ELSE
            RAISE EXCEPTION 'No active stores found to assign employees to';
        END IF;
    ELSE
        RAISE NOTICE 'All employees have store_id assigned';
    END IF;
END $$;

-- Add constraint to prevent future NULL values
DO $$
BEGIN
    -- Check if constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'employees_store_id_not_null'
    ) THEN
        ALTER TABLE employees 
        ALTER COLUMN store_id SET NOT NULL;
        RAISE NOTICE 'Added NOT NULL constraint to store_id';
    ELSE
        RAISE NOTICE 'NOT NULL constraint already exists';
    END IF;
END $$;

-- Verify the fix
SELECT 
    COUNT(*) as total_employees,
    COUNT(store_id) as with_store,
    COUNT(*) - COUNT(store_id) as without_store
FROM employees;