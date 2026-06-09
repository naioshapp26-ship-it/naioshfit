-- Migration: Add platform payment settings table
-- Purpose: Store Stripe keys for the super admin platform level

-- Platform payment settings (super admin Stripe keys)
CREATE TABLE IF NOT EXISTS platform_payment_settings (
  id SERIAL PRIMARY KEY,
  stripe_publishable_key TEXT NOT NULL,
  stripe_secret_key TEXT NOT NULL, -- Encrypted before storage
  stripe_webhook_secret TEXT, -- For webhook signature verification
  is_live_mode BOOLEAN DEFAULT false, -- Test mode vs Live mode
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER,
  updated_by INTEGER
);

-- Only one active configuration at a time (singleton pattern)
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_payment_settings_singleton 
ON platform_payment_settings ((true));

-- Platform payment transactions log
CREATE TABLE IF NOT EXISTS platform_payment_transactions (
  id SERIAL PRIMARY KEY,
  stripe_payment_id TEXT NOT NULL,
  stripe_checkout_session_id TEXT,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(50) NOT NULL,
  payment_type VARCHAR(50),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_payment_transactions_stripe_payment_id 
ON platform_payment_transactions(stripe_payment_id);

CREATE INDEX IF NOT EXISTS idx_platform_payment_transactions_tenant_id 
ON platform_payment_transactions(tenant_id);

CREATE INDEX IF NOT EXISTS idx_platform_payment_transactions_status 
ON platform_payment_transactions(status);

CREATE INDEX IF NOT EXISTS idx_platform_payment_transactions_created_at 
ON platform_payment_transactions(created_at DESC);
