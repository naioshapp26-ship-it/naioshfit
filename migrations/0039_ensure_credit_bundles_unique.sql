-- Deduplicate credit bundles by tenant + name
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY tenant_id, name ORDER BY created_at, id) AS rn
  FROM credit_bundles
)
DELETE FROM credit_bundles cb
USING ranked r
WHERE cb.id = r.id AND r.rn > 1;

-- Enforce uniqueness to prevent duplicate seeding
CREATE UNIQUE INDEX IF NOT EXISTS credit_bundles_tenant_name_idx ON credit_bundles(tenant_id, name);
