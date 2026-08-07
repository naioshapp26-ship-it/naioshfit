-- Add password reset tokens table for email-based password recovery
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" TEXT NOT NULL UNIQUE,
  "expires_at" TIMESTAMP NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "used_at" TIMESTAMP
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_token_hash_idx" ON "password_reset_tokens"("token_hash");

-- Comment on table for documentation
COMMENT ON TABLE "password_reset_tokens" IS 'Stores hashed tokens for email-based password reset with expiration';
COMMENT ON COLUMN "password_reset_tokens"."token_hash" IS 'SHA256 hash of the reset token (token is sent via email)';
COMMENT ON COLUMN "password_reset_tokens"."expires_at" IS 'Token expiration time (typically 1 hour from creation)';
COMMENT ON COLUMN "password_reset_tokens"."used_at" IS 'Timestamp when token was used (prevents reuse)';
