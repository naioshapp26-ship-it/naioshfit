-- Super Admin Control Center: platform lifecycle metadata + immutable audit trail

-- Allow administrative "disabled" status (reversible, data-preserving)
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
ALTER TABLE tenants
  ADD CONSTRAINT tenants_status_check
  CHECK (status IN ('active', 'suspended', 'disabled', 'deleted', 'pending_payment'));

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_by TEXT,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disabled_by TEXT,
  ADD COLUMN IF NOT EXISTS previous_status TEXT,
  ADD COLUMN IF NOT EXISTS product_type TEXT;

CREATE INDEX IF NOT EXISTS tenants_product_type_idx ON tenants(product_type);

CREATE TABLE IF NOT EXISTS saas_admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  entity_name TEXT,
  actor_id TEXT,
  actor_name TEXT,
  actor_role TEXT,
  previous_state JSONB,
  new_state JSONB,
  reason TEXT,
  internal_notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS saas_admin_audit_logs_created_idx ON saas_admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS saas_admin_audit_logs_action_idx ON saas_admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS saas_admin_audit_logs_entity_idx ON saas_admin_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS saas_admin_audit_logs_actor_idx ON saas_admin_audit_logs(actor_id);
