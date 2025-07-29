-- Fix employee store assignments
-- This migration ensures all employees have a store_id assigned

-- First, let's check if there are any employees without store_id
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
        -- Get the first active store as default
        SELECT id INTO default_store_id
        FROM stores
        WHERE is_active = true
        ORDER BY created_at
        LIMIT 1;
        
        IF default_store_id IS NOT NULL THEN
            -- Update all employees without store_id
            UPDATE employees
            SET store_id = default_store_id
            WHERE store_id IS NULL;
            
            RAISE NOTICE 'Updated % employees with default store_id: %', unassigned_count, default_store_id;
        ELSE
            RAISE EXCEPTION 'No active stores found to assign employees to';
        END IF;
    END IF;
END $$;

-- Make store_id NOT NULL to prevent future issues
-- First check if the constraint already exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'employees' 
        AND column_name = 'store_id' 
        AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE employees ALTER COLUMN store_id SET NOT NULL;
    END IF;
END $$;