-- Align legacy platform payment transactions with tenant UUIDs and timestamptz
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'platform_payment_transactions'
      AND column_name = 'tenant_id'
      AND udt_name IN ('int4', 'int8')
  ) THEN
    ALTER TABLE platform_payment_transactions
      ALTER COLUMN tenant_id TYPE uuid USING NULLIF(tenant_id::text, '')::uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'platform_payment_transactions'
      AND column_name = 'created_at'
      AND udt_name = 'timestamp'
  ) THEN
    ALTER TABLE platform_payment_transactions
      ALTER COLUMN created_at TYPE timestamptz USING created_at::timestamptz,
      ALTER COLUMN updated_at TYPE timestamptz USING updated_at::timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_platform_payment_transactions_created_at_desc
  ON platform_payment_transactions(created_at DESC);
