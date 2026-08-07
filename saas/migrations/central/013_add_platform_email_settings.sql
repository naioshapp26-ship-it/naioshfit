-- Migration: Add platform email settings table
-- Purpose: Store SMTP settings for central domain password reset and transactional emails

CREATE TABLE IF NOT EXISTS platform_email_settings (
  id SERIAL PRIMARY KEY,
  smtp_host TEXT NOT NULL,
  smtp_port INTEGER NOT NULL DEFAULT 465,
  smtp_user TEXT NOT NULL,
  smtp_pass TEXT NOT NULL, -- Encrypted before storage
  smtp_from TEXT NOT NULL,
  smtp_to TEXT,
  use_tls BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER,
  updated_by INTEGER
);

-- Singleton settings row for platform scope
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_email_settings_singleton
ON platform_email_settings ((true));
