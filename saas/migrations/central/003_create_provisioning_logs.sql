-- Central DB: provisioning logs table
CREATE TABLE IF NOT EXISTS provisioning_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  step TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed')),
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS provisioning_logs_tenant_idx ON provisioning_logs(tenant_id);
CREATE INDEX IF NOT EXISTS provisioning_logs_status_idx ON provisioning_logs(status);
