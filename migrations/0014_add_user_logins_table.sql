-- Add user logins tracking table
CREATE TABLE IF NOT EXISTS "user_logins" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "login_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "ip_address" TEXT,
  "user_agent" TEXT
);

-- Create index for faster queries on user_id and login_at
CREATE INDEX IF NOT EXISTS "user_logins_user_id_idx" ON "user_logins"("user_id");
CREATE INDEX IF NOT EXISTS "user_logins_login_at_idx" ON "user_logins"("login_at");
CREATE INDEX IF NOT EXISTS "user_logins_user_id_login_at_idx" ON "user_logins"("user_id", "login_at");
