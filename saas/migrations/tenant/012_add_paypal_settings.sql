-- Migration: Add PayPal settings and transaction fields to tenant tables

ALTER TABLE tenant_payment_settings
  ADD COLUMN IF NOT EXISTS paypal_client_id TEXT,
  ADD COLUMN IF NOT EXISTS paypal_client_secret TEXT,
  ADD COLUMN IF NOT EXISTS paypal_webhook_id TEXT,
  ADD COLUMN IF NOT EXISTS paypal_merchant_id TEXT,
  ADD COLUMN IF NOT EXISTS paypal_is_live_mode BOOLEAN DEFAULT false;

ALTER TABLE tenant_payment_transactions
  ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS paypal_order_id TEXT,
  ADD COLUMN IF NOT EXISTS paypal_capture_id TEXT,
  ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS paypal_payer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_tenant_payment_transactions_paypal_order_id
  ON tenant_payment_transactions(paypal_order_id);

CREATE INDEX IF NOT EXISTS idx_tenant_payment_transactions_paypal_subscription_id
  ON tenant_payment_transactions(paypal_subscription_id);
