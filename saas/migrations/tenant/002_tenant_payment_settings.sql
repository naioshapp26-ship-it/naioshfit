-- Migration: Add tenant payment settings table
-- Purpose: Store Stripe keys for each tenant to receive their own payments

-- Tenant payment settings (tenant-specific Stripe keys)
CREATE TABLE IF NOT EXISTS tenant_payment_settings (
  id SERIAL PRIMARY KEY,
  stripe_publishable_key TEXT NOT NULL,
  stripe_secret_key TEXT NOT NULL, -- Encrypted before storage
  stripe_webhook_secret TEXT, -- For webhook signature verification
  is_live_mode BOOLEAN DEFAULT false, -- Test mode vs Live mode
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id)
);

-- Only one active configuration at a time per tenant (singleton pattern)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_payment_settings_singleton 
ON tenant_payment_settings ((true));

-- Tenant payment transactions log (for tenant's own sales)
CREATE TABLE IF NOT EXISTS tenant_payment_transactions (
  id SERIAL PRIMARY KEY,
  stripe_payment_id TEXT NOT NULL,
  stripe_checkout_session_id TEXT,
  customer_user_id INTEGER REFERENCES users(id), -- Customer who made the purchase
  order_id INTEGER, -- If related to an order (references orders table if it exists)
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(50) NOT NULL, -- pending, completed, failed, refunded
  payment_type VARCHAR(50), -- course, product, subscription, etc.
  metadata JSONB, -- Additional payment details
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenant_payment_transactions_stripe_payment_id 
ON tenant_payment_transactions(stripe_payment_id);

CREATE INDEX IF NOT EXISTS idx_tenant_payment_transactions_customer_user_id 
ON tenant_payment_transactions(customer_user_id);

CREATE INDEX IF NOT EXISTS idx_tenant_payment_transactions_order_id 
ON tenant_payment_transactions(order_id);

CREATE INDEX IF NOT EXISTS idx_tenant_payment_transactions_status 
ON tenant_payment_transactions(status);

CREATE INDEX IF NOT EXISTS idx_tenant_payment_transactions_created_at 
ON tenant_payment_transactions(created_at DESC);
