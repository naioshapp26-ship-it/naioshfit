-- Drop email column from users table (idempotent)
ALTER TABLE "users" DROP COLUMN IF EXISTS "email";
