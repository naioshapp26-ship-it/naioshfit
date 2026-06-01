-- Migration: Sync email from username automatically
-- Purpose: Ensure email field is always populated when username contains an email address
-- This prevents the email/username NULL cycle issue

-- First, backfill any existing NULL emails where username is an email address
UPDATE users
SET email = LOWER(username)
WHERE username ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' 
  AND email IS NULL;

-- Create trigger function to auto-sync email from username
CREATE OR REPLACE FUNCTION sync_email_from_username()
RETURNS TRIGGER AS $$
BEGIN
  -- If username looks like an email and email is NULL/empty, copy username to email
  IF NEW.username ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    IF NEW.email IS NULL OR NEW.email = '' THEN
      NEW.email := LOWER(NEW.username);
    END IF;
  END IF;
  
  -- CRITICAL: Never allow email or username to be NULL if the other contains a valid email
  IF (NEW.email IS NULL OR NEW.email = '') AND OLD.email IS NOT NULL AND OLD.email != '' THEN
    NEW.email := OLD.email; -- Prevent email from being cleared
  END IF;
  
  IF (NEW.username IS NULL OR NEW.username = '') AND OLD.username IS NOT NULL AND OLD.username != '' THEN
    NEW.username := OLD.username; -- Prevent username from being cleared
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists (for idempotency)
DROP TRIGGER IF EXISTS trigger_sync_email_username ON users;

-- Create trigger that fires BEFORE INSERT OR UPDATE
CREATE TRIGGER trigger_sync_email_username
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION sync_email_from_username();

-- Add comment for documentation
COMMENT ON FUNCTION sync_email_from_username() IS 
'Automatically syncs email from username when username contains an email address. Prevents NULL email/username cycle issue.';
