-- Central DB: tenant_admins table
CREATE TABLE IF NOT EXISTS tenant_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS tenant_admins_tenant_idx ON tenant_admins(tenant_id);

CREATE TRIGGER set_tenant_admins_updated_at
  BEFORE UPDATE ON tenant_admins
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
