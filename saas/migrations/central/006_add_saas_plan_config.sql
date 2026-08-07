-- Migration: Add SaaS plan configuration to platform payment settings
-- Purpose: Store subscription plan names, price IDs, and trial period for tenant subscriptions

ALTER TABLE platform_payment_settings
  ADD COLUMN IF NOT EXISTS saas_plan_config JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS saas_trial_days INTEGER DEFAULT 14;

UPDATE platform_payment_settings
SET saas_plan_config = COALESCE(saas_plan_config, '[]'::jsonb),
    saas_trial_days = COALESCE(saas_trial_days, 14);
