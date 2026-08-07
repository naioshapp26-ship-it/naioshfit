-- Migration: Add Paymob settings and transaction fields to platform tables

ALTER TABLE platform_payment_settings
  ADD COLUMN IF NOT EXISTS paymob_public_key TEXT,
  ADD COLUMN IF NOT EXISTS paymob_secret_key TEXT,
  ADD COLUMN IF NOT EXISTS paymob_hmac_secret TEXT,
  ADD COLUMN IF NOT EXISTS paymob_integration_ids JSONB,
  ADD COLUMN IF NOT EXISTS paymob_base_url TEXT,
  ADD COLUMN IF NOT EXISTS paymob_is_live_mode BOOLEAN DEFAULT false;

ALTER TABLE platform_payment_transactions
  ADD COLUMN IF NOT EXISTS paymob_intention_id TEXT,
  ADD COLUMN IF NOT EXISTS paymob_transaction_id TEXT;

CREATE INDEX IF NOT EXISTS idx_platform_payment_transactions_paymob_intention_id
  ON platform_payment_transactions(paymob_intention_id);

CREATE INDEX IF NOT EXISTS idx_platform_payment_transactions_paymob_transaction_id
  ON platform_payment_transactions(paymob_transaction_id);
