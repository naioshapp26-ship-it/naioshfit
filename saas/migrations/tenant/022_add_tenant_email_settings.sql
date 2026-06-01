-- Migration: Add tenant email settings table
-- Purpose: Store SMTP settings for each tenant subdomain email sending

CREATE TABLE IF NOT EXISTS tenant_email_settings (
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
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id)
);

-- Singleton settings row for tenant scope
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_email_settings_singleton
ON tenant_email_settings ((true));
