-- Add pin_number column to users table
-- PIN numbers are stored unhashed for password reset functionality
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_number TEXT;
