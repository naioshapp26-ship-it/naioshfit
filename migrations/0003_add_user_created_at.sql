-- Add created_at column to users table (idempotent)
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Create index on created_at for better performance on date range queries
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
