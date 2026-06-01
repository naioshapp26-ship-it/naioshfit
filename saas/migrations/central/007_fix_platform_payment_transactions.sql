-- Align platform payment transactions with tenant UUIDs and timestamptz
ALTER TABLE platform_payment_transactions
  ALTER COLUMN tenant_id TYPE uuid USING tenant_id::text::uuid;

ALTER TABLE platform_payment_transactions
  ALTER COLUMN created_at TYPE timestamptz USING created_at::timestamptz,
  ALTER COLUMN updated_at TYPE timestamptz USING updated_at::timestamptz;

-- Ensure we keep consistent ordering index after type change
CREATE INDEX IF NOT EXISTS idx_platform_payment_transactions_created_at_desc
  ON platform_payment_transactions(created_at DESC);
