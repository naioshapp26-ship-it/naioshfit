-- Fix email/username issue in central database
-- Move email from username field to email field where username contains @

-- First, show the problem
SELECT 'BEFORE FIX:' as status;
SELECT id, username, email, first_name, last_name, role 
FROM users 
WHERE username LIKE '%@%'
ORDER BY id;

-- Fix the data: copy username to email where username looks like email
-- KEEP username field intact - it's used for authentication!
UPDATE users
SET email = LOWER(username)
WHERE username ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' AND email IS NULL;

-- Show results
SELECT 'AFTER FIX:' as status;
SELECT id, username, email, first_name, last_name, role
FROM users 
WHERE email IS NOT NULL 
ORDER BY id 
LIMIT 20;

-- Show count
SELECT 'TOTAL FIXED:' as status, COUNT(*) as count
FROM users 
WHERE email IS NOT NULL;
