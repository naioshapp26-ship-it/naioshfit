-- Add last_activity_at to users table for tracking app usage
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_activity_at" TIMESTAMP;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS "users_last_activity_at_idx" ON "users"("last_activity_at");
