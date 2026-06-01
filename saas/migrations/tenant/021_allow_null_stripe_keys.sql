-- Migration: Allow NULL values for Stripe keys in tenant_payment_settings
-- Purpose: Enable tenants to delete/disable Stripe payment provider
-- Date: 2026-03-02

-- Make Stripe keys optional to allow disabling Stripe as a payment provider
ALTER TABLE tenant_payment_settings 
  ALTER COLUMN stripe_publishable_key DROP NOT NULL,
  ALTER COLUMN stripe_secret_key DROP NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN tenant_payment_settings.stripe_publishable_key IS 
  'Stripe publishable key. NULL means Stripe is disabled.';

COMMENT ON COLUMN tenant_payment_settings.stripe_secret_key IS 
  'Encrypted Stripe secret key. NULL means Stripe is disabled.';
