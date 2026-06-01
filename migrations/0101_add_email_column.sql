-- Add email column back to users table for email-based login
-- Email is now the primary login method, whatsapp_with_code is optional

ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;

-- Create unique index on email (allowing nulls for backward compatibility)
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email) WHERE email IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.email IS 'User email address - primary login method';
